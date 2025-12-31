import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { getPassStats, type DebugStats } from './stats';
import { applyCarrierFlowAndPersistence, applyHubVelocityScaling } from './velocityPass';

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
        // Very slow, very tiny drift to globalAngle - "water touching the underside"
        // =====================================================================
        const t = engine.lifecycle;
        const microDrift =
            Math.sin(t * 0.3) * 0.0008 +  // ~20 second period, tiny amplitude
            Math.sin(t * 0.7) * 0.0004 +  // ~9 second period, tinier
            Math.sin(t * 1.1) * 0.0002;   // ~6 second period, tiniest
        engine.globalAngle += microDrift * dt;
    }

    // =====================================================================
    // INTEGRATION: Simple unified damping (no radial/tangent split)
    // All forces already scaled by energy. Damping increases as energy falls.
    // =====================================================================
    const passStats = getPassStats(stats, 'Integration');
    const affected = new Set<string>();

    for (const node of nodeList) {
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

        const ax = node.fx / effectiveMass;
        const ay = node.fy / effectiveMass;

        // Update Velocity
        node.vx += ax * dt;
        node.vy += ay * dt;

        if (!preRollActive) {
            applyCarrierFlowAndPersistence(engine, nodeList, node, energy, stats);
        }

        // Apply unified damping (increases as energy falls)
        if (preRollActive) {
            node.vx *= 0.995;
            node.vy *= 0.995;
        } else {
            node.vx *= (1 - effectiveDamping * dt * 5.0);
            node.vy *= (1 - effectiveDamping * dt * 5.0);
        }

        if (!preRollActive) {
            applyHubVelocityScaling(engine, node, stats);
        }

        // Clamp Velocity
        const velocityCap = preRollActive ? 8.0 : maxVelocityEffective;
        const vSq = node.vx * node.vx + node.vy * node.vy;
        if (vSq > velocityCap * velocityCap) {
            const v = Math.sqrt(vSq);
            node.vx = (node.vx / v) * velocityCap;
            node.vy = (node.vy / v) * velocityCap;
            clampHitCount++;
        }

        // Update Position
        node.x += node.vx * dt;
        node.y += node.vy * dt;

        // Sleep Check (optional - keeps physics running but zeros micro-motion)
        if (engine.config.velocitySleepThreshold) {
            const velSq = node.vx * node.vx + node.vy * node.vy;
            const threshSq = engine.config.velocitySleepThreshold * engine.config.velocitySleepThreshold;
            if (velSq < threshSq) {
                node.vx = 0;
                node.vy = 0;
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

    passStats.nodes += affected.size;

    return {
        centroidX,
        centroidY,
    };
};
