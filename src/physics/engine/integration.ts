import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { getPassStats, type DebugStats } from './stats';
import { applyCarrierFlowAndPersistence, applyHubVelocityScaling } from './velocityPass';
import { applyBaseIntegration, clampVelocity } from './velocity/baseIntegration';
import { applyDamping } from './velocity/damping';

export type IntegrationResult = {
    centroidX: number;
    centroidY: number;
};

export const integrateNodes = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    dt: number,
    energy: number,
    effectiveDamping: number,
    maxVelocityEffective: number,
    stats: DebugStats,
    preRollActive: boolean
): IntegrationResult => {
    let clampHitCount = 0;

    // Calculate live centroid (needed for global spin and anisotropic damping)
    let centroidX = 0, centroidY = 0;
    for (const node of nodeList) {
        centroidX += node.x;
        centroidY += node.y;
    }
    centroidX /= nodeList.length;
    centroidY /= nodeList.length;

    if (!preRollActive) {
        // =====================================================================
        // ROTATING MEDIUM: Spin decays with energy, angle accumulates
        // (Rotation is applied at RENDER time, physics doesn't see it)
        // No capture moment. Spin was initialized at birth and just fades.
        // =====================================================================
        engine.globalAngularVel *= Math.exp(-engine.config.spinDamping * dt);
        engine.globalAngle += engine.globalAngularVel * dt;

        // =====================================================================
        // WATER MICRO-DRIFT: The water is alive, not glass
        // FIX 31: True Rest (Kill Idle Drift)
        // Gate behind energy threshold to ensure Dead-Still Idle.
        // Only active when graph is "awake" or user is interacting.
        // =====================================================================
        if (engine.config.enableMicroDrift && energy > 0.05) {
            const t = engine.lifecycle;
            const microDrift =
                Math.sin(t * 0.3) * 0.0008 +
                Math.sin(t * 0.7) * 0.0004 +
                Math.sin(t * 1.1) * 0.0002;
            engine.globalAngle += microDrift * dt;
        }
    }

    // =====================================================================
    // =====================================================================
    // INTEGRATION PRIORITY BANDS: Persistent solver asymmetry
    // During early expansion, nodes integrate in deterministic priority order
    // Lower priority moves first EVERY frame → symmetry cannot reform
    // =====================================================================
    const earlyExpansion = energy > 0.85;
    let integrationOrder = nodeList;

    if (earlyExpansion && !preRollActive) {
        // Assign deterministic priority to each node
        const nodePriorities = nodeList.map((node, originalIndex) => {
            // Hash-based priority (0-99)
            let hash = 0;
            for (let i = 0; i < node.id.length; i++) {
                hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
                hash |= 0;
            }
            const priority = Math.abs(hash) % 100;

            return { node, priority, originalIndex };
        });

        // Sort by priority: lower values integrate first
        nodePriorities.sort((a, b) => a.priority - b.priority);
        integrationOrder = nodePriorities.map(item => item.node);
    }

    // Integration loop (in priority order during early expansion)
    const passStats = getPassStats(stats, 'Integration');
    const affected = new Set<string>();

    for (const node of integrationOrder) {
        if (node.isFixed) continue;

        const beforeVx = node.vx;
        const beforeVy = node.vy;

        // DEGREE-BASED INERTIA: High-degree nodes feel heavier
        // Prevents hub overshoot → no visible corrections
        let inertiaDeg = 0;
        for (const link of engine.links) {
            if (link.source === node.id || link.target === node.id) inertiaDeg++;
        }
        const massFactor = 0.4;  // How much degree increases mass
        const effectiveMass = node.mass * (1 + massFactor * Math.max(inertiaDeg - 1, 0));

        // DEGREE-BASED FORCE LOW-PASS FILTER: Hubs perceive delayed forces
        // Creates temporal asymmetry at force perception level
        // Low-degree nodes respond instantly, hubs see "ghosted" force field
        let effectiveFx = node.fx;
        let effectiveFy = node.fy;

        if (!preRollActive && energy > 0.8 && inertiaDeg >= 3) {
            // Initialize force memory on first use
            if (node.prevFx === undefined) node.prevFx = 0;
            if (node.prevFy === undefined) node.prevFy = 0;

            // Low-pass filter: blend current with previous frame
            // FIX 18: Hub Lag Tail Snap
            // If input force stops (negligible), snap immediately to prevent asymptotic drift.
            if (Math.abs(node.fx) < 0.01 && Math.abs(node.fy) < 0.01) {
                effectiveFx = node.fx;
                effectiveFy = node.fy;
                node.prevFx = node.fx;
                node.prevFy = node.fy;
            } else {
                const alpha = 0.3;  // 30% previous, 70% current (temporal lag)
                effectiveFx = alpha * node.prevFx + (1 - alpha) * node.fx;
                effectiveFy = alpha * node.prevFy + (1 - alpha) * node.fy;
            }
        }

        // Compute acceleration from effective (possibly lagged) forces
        const ax = effectiveFx / effectiveMass;
        const ay = effectiveFy / effectiveMass;

        // Store current forces for next frame (before clearing)
        node.prevFx = node.fx;
        node.prevFy = node.fy;

        // TEMPORAL DECOHERENCE: deterministic dt skew during early expansion
        // Breaks time symmetry so equilibrium cannot form
        let nodeDt = dt;
        if (!preRollActive && energy > 0.85) {
            // Hash-based dt skew: ±3% variation
            let hash = 0;
            for (let i = 0; i < node.id.length; i++) {
                hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
                hash |= 0;
            }
            const skew = (Math.abs(hash) % 100) / 100; // 0-1

            // FIX #15: CONSTRAINED DT SKEW
            // Reduced max skew from ±3% to ±1% for better determinism.
            // Disabled entirely if node is interacting (dragged) to ensure hand authority.
            // FIX #21: TEMPORAL COHERENCE
            // Default to uniform DT (skew=0) to prevent cluster drift.
            // Only enable skew if debug is active for stress testing.
            const isInteracting = node.id === engine.draggedNodeId;
            const skewMagnitude = (engine.config.debugPerf && !isInteracting) ? 0.02 : 0;

            const dtMultiplier = (1.0 - skewMagnitude) + skew * (2 * skewMagnitude); // 0.98 to 1.02
            nodeDt = dt * dtMultiplier;

            // Track min/max for debug (first 10 frames)
            if (engine.frameIndex <= 10) {
                if (!stats.dtSkew) stats.dtSkew = { min: Infinity, max: -Infinity };
                stats.dtSkew.min = Math.min(stats.dtSkew.min, nodeDt);
                stats.dtSkew.max = Math.max(stats.dtSkew.max, nodeDt);
            }
        }

        // Update Velocity (with temporal decoherence)
        applyBaseIntegration(node, ax, ay, nodeDt);

        if (!preRollActive) {
            applyCarrierFlowAndPersistence(engine, nodeList, node, energy, stats);
        }

        // Apply unified damping (increases as energy falls) - use nodeDt
        applyDamping(node, preRollActive, effectiveDamping, nodeDt);

        if (!preRollActive) {
            applyHubVelocityScaling(engine, node, stats, energy, nodeList);
        }

        // Clamp Velocity
        const velocityCap = preRollActive ? 8.0 : maxVelocityEffective;
        if (clampVelocity(node, velocityCap)) {
            clampHitCount++;
        }

        // Update Position - use nodeDt for temporal decoherence
        node.x += node.vx * nodeDt;
        node.y += node.vy * nodeDt;

        // Sleep Check (Smart Force-Aware)
        // FIX #7: Only sleep if velocity is low AND acting force is low.
        // Prevents nodes from sleeping while under tension (e.g. held by springs).
        const sleepThreshold = engine.config.velocitySleepThreshold;
        if (sleepThreshold) {
            const velSq = node.vx * node.vx + node.vy * node.vy;
            const threshSq = sleepThreshold * sleepThreshold;

            // Force check: F = ma. If F/m is large, we will accelerate soon.
            // Threshold: if acceleration * dt > sleepThreshold, we shouldn't sleep.
            const accX = node.fx / (node.mass || 1);
            const accY = node.fy / (node.mass || 1);
            const accSq = accX * accX + accY * accY;
            // Allow sleep only if force is negligible (< 1% of velocity threshold impact)
            // FIX 31: Stricter Force Silence (was 0.1, now 0.01)
            const forceSilent = accSq * (dt * dt) < (threshSq * 0.01);

            // FIX 13: Pressure Check (Constraint Residuals)
            // Prevent sleeping if under significant constraint stress (e.g. pulled by spring)
            // FIX 31: Stricter Pressure Silence (was 0.1 check, now 0.01)
            const pressureSilent = (node.lastCorrectionMag ?? 0) < 0.01;

            const sleepFramesRequired = engine.config.sleepFramesThreshold ?? 30;

            if (velSq < threshSq && forceSilent && pressureSilent) {
                node.sleepFrames = (node.sleepFrames ?? 0) + 1;
                if (node.sleepFrames >= sleepFramesRequired) {
                    node.isSleeping = true;
                    node.vx = 0;
                    node.vy = 0;
                }
            } else {
                node.sleepFrames = 0;
                node.isSleeping = false;
            }
        }

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }
    }

    // Debug: log dt skew range for first 10 frames
    if (engine.frameIndex <= 10 && stats.dtSkew) {
        console.log(`[Frame ${engine.frameIndex}] dt skew: ${stats.dtSkew.min.toFixed(6)} - ${stats.dtSkew.max.toFixed(6)} (base dt: ${dt.toFixed(6)})`);
    }

    passStats.nodes += affected.size;

    return {
        centroidX,
        centroidY,
    };
};
