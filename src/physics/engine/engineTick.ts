import type { PhysicsNode } from '../types';
import { applyBoundaryForce } from '../forces';
import { runPreRollPhase } from './preRollPhase';
import { advanceEscapeWindow } from './escapeWindow';
import { computeEnergyEnvelope } from './energy';
import { applyForcePass } from './forcePass';
import { integrateNodes } from './integration';
import { computeNodeDegrees } from './degrees';
import {
    applyEdgeRelaxation,
    applySafetyClamp,
    applySpacingConstraints,
    applyTriangleAreaConstraints,
    initializeCorrectionAccum,
} from './constraints';
import { applyCorrectionsWithDiffusion } from './corrections';
import { createMotionPolicy } from './motionPolicy';
import {
    applyAngleResistanceVelocity,
    applyAngularVelocityDecoherence,
    applyDenseCoreInertiaRelaxation,
    applyDenseCoreVelocityDeLocking,
    applyDistanceBiasVelocity,
    applyDragVelocity,
    applyEdgeShearStagnationEscape,
    applyExpansionResistance,
    applyLocalPhaseDiffusion,
    applyPreRollVelocity,
    applyStaticFrictionBypass,
} from './velocityPass';
import { createDebugStats, type DebugStats } from './stats';
import { getNowMs } from './engineTime';
import type { PhysicsEngineTickContext } from './engineTickTypes';
import { runTickPreflight } from './engineTickPreflight';
import { computeSpacingState } from './engineTickSpacing';
import { updateHudSnapshot } from './engineTickHud';
import { finalizePhysicsTick } from './engineTickFinalize';



// FORENSICS: Mode Isolation Tripwire
// Detects if a Legacy pass runs while XPBD mode is active
const assertMode = (engine: PhysicsEngineTickContext, stats: DebugStats, passName: string) => {
    if (engine.config.useXPBD) {
        // LEAK DETECTED
        stats.forbiddenPassCount++;
        stats.forbiddenLeakLatched = true;
        stats.forbiddenPassLast = passName;
        // Latch on engine to survive frame reset (optional, but stats is per-tick)
        // We really want it visible in HUD, so DebugStats is the transport.
        // Also log once per second to avoid console spam
        if (Math.random() < 0.01) {
            console.error(`[XPBD-LEAK] Forbidden Legacy Pass '${passName}' executed in XPBD Mode!`);
        }
    }
};

export const runPhysicsTickLegacy = (engine: PhysicsEngineTickContext, dtIn: number) => {
    // FIX: Startup Safety - Clamp DT for first 2 seconds to prevent insertion shock
    // If the browser hung during setup, dt could be 100ms+.
    // We clamp to 32ms (approx 30fps) during startup, then 64ms normal cap.
    const nodeList = engine.getNodeList();
    const preflight = runTickPreflight(engine, nodeList);
    const isStartup = preflight.isStartup;

    // CONST Time Hardening (DT Policy)
    const policyResult = engine.timePolicy.evaluate(dtIn * 1000);
    const dt = policyResult.dtUseSec;
    const dtRawMs = dtIn * 1000;

    // Update Firewall Stats from Policy
    if (policyResult.isSpike) {
        engine.firewallStats.dtClamps += 1;
        if (isStartup) engine.startupStats.dtClamps++;
    }

    // Forensics to HUD
    if (engine.hudSnapshot) {
        engine.hudSnapshot.dtRawMs = dtRawMs;
        engine.hudSnapshot.dtUseMs = policyResult.dtUseMs;
        engine.hudSnapshot.dtSpikeCount = policyResult.spikeCount;
        engine.hudSnapshot.quarantineStrength = policyResult.quarantineStrength;
    }


    const budgetState = engine as PhysicsEngineTickContext & { _currentBudgetScale?: number };

    // FIX #7: Fixed Dot Authority Check (Snapshot)
    const fixedSnapshots = new Map<string, { x: number; y: number }>();
    if (engine.config.debugPerf) {
        for (const node of nodeList) {
            if (node.isFixed) {
                fixedSnapshots.set(node.id, { x: node.x, y: node.y });
            }
        }
    }

    const debugStats = createDebugStats();
    debugStats.hubFlipCount = preflight.frameHubFlips;
    debugStats.hubNodeCount = preflight.frameHubNodeCount;
    debugStats.injectors.stuckScoreSum = preflight.frameStuckScoreSum;

    const perfEnabled = engine.config.debugPerf === true;
    const allocCounter = perfEnabled ? { newEntries: 0 } : undefined;
    const frameTiming = perfEnabled
        ? {
            repulsionMs: 0,
            collisionMs: 0,
            springsMs: 0,
            spacingMs: 0,
            pbdMs: 0,
            totalMs: 0,
        }
        : null;
    const tickStart = perfEnabled ? getNowMs() : 0;

    // FORENSICS: Energy Ledger
    // Helper to compute total kinetic energy proxy (sum v^2)
    const measureEnergy = (stageName: string, lastE: number) => {
        let e = 0;
        for (const node of nodeList) {
            e += node.vx * node.vx + node.vy * node.vy;
        }
        debugStats.energyLedger.push({
            stage: stageName,
            energy: e,
            delta: e - lastE
        });
        return e;
    };
    let currentEnergy = measureEnergy('PreTick', 0); // Init

    // FORENSICS: Fight Ledger
    const measureFight = (stageName: string, accum?: Map<string, { dx: number; dy: number }>) => {
        let avgCorr = 0;
        let conflictCount = 0;
        let nodeCount = nodeList.length || 1;

        if (accum) {
            let sumCorr = 0;
            for (const node of nodeList) {
                const c = accum.get(node.id);
                if (c) {
                    const mag = Math.sqrt(c.dx * c.dx + c.dy * c.dy);
                    sumCorr += mag;
                    if ((c.dx * node.vx + c.dy * node.vy) < 0) {
                        conflictCount++;
                    }
                }
            }
            avgCorr = sumCorr / nodeCount;
        } else {
            // Fallback: use stats if available (post-correction)
            conflictCount = debugStats.correctionConflictCount;
        }

        debugStats.fightLedger.push({
            stage: stageName,
            conflictPct: (conflictCount / nodeCount) * 100,
            avgCorr: avgCorr
        });
    };
    measureFight('PreTick');

    // FORENSICS: Write Ownership Canary
    const measurePosSum = (stageName: string) => {
        if (!debugStats) return;
        let sum = 0;
        for (const node of nodeList) {
            sum += node.x + node.y;
        }
        debugStats.canaryTrace.push({ stage: stageName, hash: sum });
    };
    measurePosSum('PreTick');

    // XPBD Canary: One-Shot Shift
    if (dt > 0) { // Safety check
        if (engine.config.debugXPBDCanary) {
            if (!engine.xpbdCanaryApplied) {
                // Apply Nudge
                const target = nodeList[0]; // First node
                if (target && !target.isFixed) {
                    target.x += 30;
                    // target.y -= 20; // Single axis enough for verification
                    engine.xpbdCanaryApplied = true;
                    if (debugStats) debugStats.canaryShiftApplied = true;
                }
            }
        } else {
            // Reset if toggle off
            engine.xpbdCanaryApplied = false;
        }
    }

    // Run 2: Drag Firewall
    engine.dragActive = engine.draggedNodeId !== null;

    engine.awakeList.length = 0;
    engine.sleepingList.length = 0;
    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        node.listIndex = i;

        // Run 2: Force Awake if Dragging (Bypass Dynamic Sleep)
        // Fixed nodes still sleep to avoid O(N²) static repulsion
        const isFixed = node.isFixed && node.id !== engine.draggedNodeId;
        const reflectsSleep = node.isSleeping === true && !engine.dragActive;

        if (isFixed || reflectsSleep) {
            engine.sleepingList.push(node);
        } else {
            engine.awakeList.push(node);
        }
    }

    // Lifecycle Management
    // Lifecycle Management
    engine.lifecycle += dt;
    engine.frameIndex++;

    // 0. CONTINUOUS SENSORS
    // 0. CONTINUOUS SENSORS
    // Velocity Sensor & Outlier Detection
    let totalVelSq = 0;
    let calmCount = 0;
    const outlierSpeedSq = 0.05 * 0.05; // 0.05px/frame

    for (const node of nodeList) {
        const vSq = node.vx * node.vx + node.vy * node.vy;
        totalVelSq += vSq;

        // Outlier Check: Speed < 0.05 OR Pressure (StuckScore) showing it's trying to stop
        // Use a "Calm" predicate for global settle
        const isCalm = vSq < outlierSpeedSq || (node.stuckScore || 0) > 0.5;
        if (isCalm) calmCount++;
    }
    const nodeCount = nodeList.length || 1;
    const avgVelSq = totalVelSq / nodeCount;

    // Normalize Neighbor Delta Rate (Count -> Rate 0..1)
    if (debugStats && nodeCount > 0) {
        debugStats.neighborDeltaRate = debugStats.neighborDeltaRate / nodeCount;
    }

    // FORENSIC STATS
    const outlierCount = nodeCount - calmCount;
    const calmPercent = (calmCount / nodeCount);

    if (debugStats) {
        debugStats.outlierCount = outlierCount;
        debugStats.calmPercent = calmPercent * 100;
    }

    // Load Sensor (Continuous Degrade)
    // Map node count to pressure roughly: 180 -> 0.0, 500 -> 1.0
    const linkCount = engine.links.length;
    const loadN = Math.max(0, nodeCount - 150) / 350;
    const loadE = Math.max(0, linkCount - 200) / 800;
    const rawDegrade = Math.min(1, Math.max(loadN, loadE));
    // Smooth it
    const degradeLerp = 0.05;
    engine.degradeLevel = engine.degradeLevel * (1 - degradeLerp) + rawDegrade * degradeLerp;

    // Legacy compat
    if (engine.degradeLevel > 0.8) engine.perfMode = 'fatal';
    else if (engine.degradeLevel > 0.5) engine.perfMode = 'emergency';
    else if (engine.degradeLevel > 0.2) engine.perfMode = 'stressed';
    else engine.perfMode = 'normal';

    const localBoostActive = (engine.draggedNodeId !== null || engine.localBoostFrames > 0);
    if (engine.draggedNodeId) engine.localBoostFrames = 8;
    else if (engine.localBoostFrames > 0) engine.localBoostFrames--;

    // =====================================================================
    // 1. MOTION POLICY (The "Brain")
    // =====================================================================
    const { energy, forceScale: rawForceScale, effectiveDamping, maxVelocityEffective } = computeEnergyEnvelope(engine.lifecycle);

    // Quarantine: Dampen forces during spike to prevent explosion
    const forceScale = rawForceScale * (1.0 - (policyResult.quarantineStrength * 0.5));

    const allowEarlyExpansion = engine.config.initStrategy === 'legacy' && engine.config.debugAllowEarlyExpansion === true;

    // FIX D: Density Scale (Compute Once)
    // Only needed for early expansion logic (stagnation escape, etc)
    engine.localDensityCache.clear();
    if (allowEarlyExpansion) {
        const R = 30; // Standard density radius
        // O(N^2) simply is safest for determinism given small N (<200).
        // For larger N, this should use spatial hash, but "Single Law" implies consistency.
        // We can optimize: use adjacency + 2 hops? No, density is spatial.
        // Stick to naive O(N^2) but optimized loop.
        const nodes = nodeList;
        const len = nodes.length;
        for (let i = 0; i < len; i++) {
            const ni = nodes[i];
            let count = 0;
            for (let j = 0; j < len; j++) {
                if (i === j) continue;
                const nj = nodes[j];
                const dx = nj.x - ni.x;
                const dy = nj.y - ni.y;
                if ((dx * dx + dy * dy) < (R * R)) count++;
            }
            engine.localDensityCache.set(ni.id, count);
        }
    }

    // Run 3: Drag Firewall (Disable throttling/degrade)
    const effectiveDegrade = engine.dragActive ? 0.0 : engine.degradeLevel;
    const motionPolicy = createMotionPolicy(energy, effectiveDegrade, avgVelSq, allowEarlyExpansion);

    // FIX: Diffusion Decay at Rest (Smooth Gating)
    // Blend settleScalar up based on calmPercent before the hard cutoff.
    // This ensures diffusion (gated by (1-settle)^2) fades out as we approach 98% calm.
    if (calmPercent > 0.5) {
        // Map 0.5..0.98 -> 0.0..1.0
        const t = Math.max(0, Math.min(1, (calmPercent - 0.5) / (0.98 - 0.5)));
        const calmFactor = t * t * (3 - 2 * t); // Smoothstep
        motionPolicy.settleScalar = Math.max(motionPolicy.settleScalar, calmFactor);
    }

    // Hard cutoff for Sleep safety
    if (calmPercent > 0.98) {
        motionPolicy.settleScalar = 1.0;
    }

    // FIX: TDZ & Stale Stats
    if (debugStats) {
        // Track Pop Score
        const prevStrength = debugStats.diffusionStrengthNow || 0;

        const diffusionSettleGate = Math.pow(1 - motionPolicy.settleScalar, 2);

        // Re-calculate effective strength relative to BASE (approx)
        // Since we don't have exact magWeight here (it's per node), we use a proxy or just track the global gate.
        // Let's track the global gate pop, as that's the main on/off switch.
        // Actually, let's just track diffusionSettleGate pop.
        const diff = Math.abs(diffusionSettleGate - prevStrength);
        debugStats.diffusionPopScore = diff; // Frame delta

        debugStats.diffusionGate = diffusionSettleGate;
        debugStats.diffusionStrengthNow = diffusionSettleGate;

        // FIX: Determinism Checksum (Quick Hash)
        // Quantize pos to 0.001 to ignore microscopic float drift
        let chk = 0;
        let maxPos = 0;

        for (const n of nodeList) {
            // Checksum
            const qx = Math.round(n.x * 1000) | 0;
            const qy = Math.round(n.y * 1000) | 0;
            // Simple integer hash
            chk = (chk * 33) ^ (qx + qy); // XOR
            // Rotate to avoid cancellation
            chk = (chk << 5) | (chk >>> 27);

            // Max Abs Pos track
            const absX = Math.abs(n.x);
            const absY = Math.abs(n.y);
            maxPos = maxPos > absX ? maxPos : absX;
            maxPos = maxPos > absY ? maxPos : absY;
        }
        // Hex string
        debugStats.determinismChecksum = (chk >>> 0).toString(16).toUpperCase();
        debugStats.maxAbsPos = maxPos;

        // FIX: Numeric Rebase (Anti-Drift)
        // 1. Local Snap: If calm, snap tiny v/delta to 0
        if (calmPercent > 0.95 && engine.draggedNodeId === null) {
            for (const n of nodeList) {
                if (Math.abs(n.vx) < 0.00001) n.vx = 0;
                if (Math.abs(n.vy) < 0.00001) n.vy = 0;
                // History convergence
                if (n.prevX !== undefined && Math.abs(n.x - n.prevX) < 0.00001) n.prevX = n.x;
                if (n.prevY !== undefined && Math.abs(n.y - n.prevY) < 0.00001) n.prevY = n.y;
            }
        }

        // 2. Global Centroid Rebase: If wandering too far, shift world
        const REBASE_THRESHOLD = 50000; // World Units
        if (maxPos > REBASE_THRESHOLD && engine.draggedNodeId === null) {
            // Compute centroid
            let cx = 0, cy = 0;
            for (const n of nodeList) { cx += n.x; cy += n.y; }
            cx /= nodeCount;
            cy /= nodeCount;

            // Shift Everything
            for (const n of nodeList) {
                n.x -= cx;
                n.y -= cy;
                if (n.prevX !== undefined) n.prevX -= cx;
                if (n.prevY !== undefined) n.prevY -= cy;
                // Last good?
                if (n.lastGoodX !== undefined) n.lastGoodX -= cx;
                if (n.lastGoodY !== undefined) n.lastGoodY -= cy;
            }
            // Update tracking
            debugStats.rebaseCount++;
            debugStats.maxAbsPos = 0; // Reset estimate until next frame

            // FIX C: Camera Sync
            // Notify renderer to shift view by (-cx, -cy) to keep visuals steady
            if (engine.onWorldShift) {
                engine.onWorldShift(-cx, -cy);
            }
        }
    }

    let spacingStride = 1;

    // =====================================================================
    // 2. SETTLE (Continuous Rest) with TOLERANCE
    // =====================================================================
    // Fix: Outlier Blocking.
    // Replace rigid average check with Percent Tolerance.
    // If 98% of nodes are calm, we allow settle.
    // We also use settleScalar as a "Hint" but rely on calmPercent for the Truth.

    const isGlobalCalm = calmPercent > 0.98; // 2% Outlier Tolerance
    const isEffectivelyStopped = motionPolicy.settleScalar > 0.99 || isGlobalCalm;

    if (isEffectivelyStopped && !localBoostActive) {
        engine.idleFrames++;
        if (engine.idleFrames > 10) {
            for (const node of nodeList) {
                node.vx = 0; node.vy = 0;
                node.fx = 0; node.fy = 0;
            }
            // Populate stats for the snapshot just before returning
            if (debugStats) {
                debugStats.diffusionGate = 0; // Force 0 at rest
            }
            updateHudSnapshot(engine, getNowMs(), dtRawMs, nodeList, debugStats, spacingStride, 'sleep');
            return;
        }
    } else if (engine.lifecycle < 2.0) {
        // Fix: Startup Safety - Do not accumulate idle frames during first 2s
        engine.idleFrames = 0;
    } else {
        // Only reset if we seem "active" enough.
        // Hysteresis: If we have > 90% calm, maybe don't fully reset?
        // For now, simple logic: if not stopped, reset.
        engine.idleFrames = 0;
    }

    // =====================================================================
    // 3. EXECUTION
    // =====================================================================
    const allowLegacyStart = engine.config.initStrategy === 'legacy';
    const preRollActive = allowLegacyStart && engine.preRollFrames > 0 && !engine.hasFiredImpulse;
    if (preRollActive) {
        runPreRollPhase(engine as any, nodeList, debugStats);
    }

    // Impulse Logic (Quarantined)
    if (allowLegacyStart && !preRollActive && engine.lifecycle < 0.1 && !engine.hasFiredImpulse) {
        if (policyResult.quarantineStrength < 0.5) {
            engine.requestImpulse();
        }
    }

    advanceEscapeWindow(engine as any);

    // Budget Scaling for Spacing/Constraint checks
    const budgetScale = 1.0 - (motionPolicy.degradeScalar * 0.8);
    // Legacy support for budgetState._currentBudgetScale
    budgetState._currentBudgetScale = budgetScale;
    const pairBudgetScale = budgetScale;
    const spacingState = computeSpacingState(engine, nodeList.length, energy, dt, pairBudgetScale);
    const pairStrideBase = spacingState.pairStrideBase;
    const pairOffset = engine.frameIndex;
    const spacingGate = spacingState.spacingGate;
    const spacingEnabled = spacingState.spacingEnabled;
    spacingStride = spacingState.spacingStride;

    const cascadeActive = false;
    const cascadePhase = 0;

    // Run 5: Guardrail (Throttle Warning)
    engine.dragThrottledTime = engine.dragThrottledTime ?? 0;
    if (engine.dragActive && spacingStride > 1.1) {
        engine.dragThrottledTime += dt;
        if (debugStats && engine.dragThrottledTime > 0.2) {
            debugStats.dragThrottledWarn = true;
        }
    } else {
        engine.dragThrottledTime = 0;
    }

    // CONTINUOUS PASS EXECUTION
    const runPairwiseForces = true;
    const spacingWillRun = spacingEnabled;
    const repulsionEnabled = !engine.config.debugDisableRepulsion;

    // Scale stride heavily with degrade to avoid N^2
    // Stride 1 -> Check 100%. Stride 5 -> Check 20%.

    const collisionEnabled = true; // Always run, but strided
    const springsEnabled = true;

    // Unused
    const repulsionEvery = 1;
    const collisionEvery = 1;
    const springsEvery = 1;
    const spacingEvery = 1;

    // Others
    const triangleEvery = 1;
    const safetyEvery = 1;
    const edgeRelaxEvery = 1;
    const microEvery = 1;

    if (perfEnabled) {
        const now = getNowMs();
        if (now - engine.spacingLogAt >= 1000) {
            engine.spacingLogAt = now;
            console.log(
                `[PhysicsSpacing] energy=${energy.toFixed(3)} ` +
                `spacingStrength=${spacingGate.toFixed(3)} ` +
                `spacingEnabled=${spacingEnabled} ` +
                `spacingFreq=${spacingEvery} ` +
                `mode=${engine.perfMode}`
            );
        }
        if (now - engine.passLogAt >= 1000) {
            engine.passLogAt = now;
            console.log(
                `[PhysicsPasses] repulsion=${runPairwiseForces} ` +
                `collision=${runPairwiseForces} ` +
                `spacing=${spacingWillRun} ` +
                `pairStride=${pairStrideBase} ` +
                `spacingStride=${spacingStride} ` +
                `pairOffset=${pairOffset} ` +
                `spacingOffset=${pairOffset + 2} ` +
                `cascade=${cascadeActive} ` +
                `phase=${cascadeActive ? cascadePhase : -1}`
            );

            // [Forensic Canary]
            // Detect if positions changed when they shouldn't have
            if (debugStats.canaryTrace.length > 0) {
                const trace = debugStats.canaryTrace;
                // Check stability between PreTick -> PostForces -> PostVMods (Should be stable? Forces/Velocity don't move nodes)
                // Integration moves nodes.
                // PostInteg -> PostConstraints (Should be stable? Constraints don't move nodes, buffer only)
                // PostCorrect -> Final (Correct moves nodes)
                const stableInteg = Math.abs(trace.find(t => t.stage === 'PostInteg')!.hash - trace.find(t => t.stage === 'PostMicro')!.hash) < 0.001; // Micro might move? No, Micro uses Force/Velocity mods usually? 
                // Wait, microSlip uses applyDenseCoreVelocityDeLocking -> VELOCITY mod.
                // But applyLocalPhaseDiffusion? 

                console.log(
                    `[Canary] Write Trace: ${trace.map(t => `${t.stage.substring(4)}:${t.hash.toFixed(1)}`).join(' -> ')}`
                );
            }

            // [PhysicsFeel] Instrumentation
            // Show effective per-second values to verify time-consistency
            // damping(0.9) @ 60hz => 0.9^60 per sec
            const dampPerSec = Math.pow(Math.exp(-effectiveDamping * 5.0 * dt), 1 / dt);
            // correctionBudget(1.5) @ 60hz => 1.5 * 60 per sec
            const budgetPerSec = engine.config.maxCorrectionPerFrame * 60;
            // spacingStrength
            const spacingStr = spacingGate;

            console.log(
                `[PhysicsFeel] mode=${engine.perfMode} ` +
                `dt=${(dt * 1000).toFixed(1)}ms ` +
                `dampPerSec=${dampPerSec.toFixed(3)} ` +
                `corrBudgetPerSec=${budgetPerSec.toFixed(1)}px ` +
                `spacingGate=${spacingStr.toFixed(3)}`
            );

            if (engine.draggedNodeId && engine.dragTarget) {
                const node = engine.nodes.get(engine.draggedNodeId);
                if (node) {
                    const dx = node.x - engine.dragTarget.x;
                    const dy = node.y - engine.dragTarget.y;
                    const lag = Math.sqrt(dx * dx + dy * dy);
                    console.log(`[Input] Drag Lag: ${lag.toFixed(2)}px (Goal: 0.00)`);
                }
            }
        }
        if (now - engine.degradeLogAt >= 1000) {
            engine.degradeLogAt = now;
            console.log(
                `[Degrade] level=${engine.degradeLevel} ` +
                `reason=${engine.degradeReason} ` +
                `budgetMs=${engine.degradeBudgetMs.toFixed(1)} ` +
                `passes={repel:${repulsionEnabled ? 'Y' : 'N'} ` +
                `coll:${collisionEnabled ? 'Y' : 'N'} ` +
                `space:${spacingWillRun ? 'Y' : 'N'} ` +
                `spring:${springsEnabled ? 'Y' : 'N'} ` +
                `tri:${(engine.perfMode === 'normal' || engine.perfMode === 'stressed') && engine.frameIndex % triangleEvery === 0 ? 'Y' : 'N'} ` +
                `safety:${engine.frameIndex % safetyEvery === 0 ? 'Y' : 'N'} ` +
                `diff:Y micro:${engine.frameIndex % microEvery === 0 ? 'Y' : 'N'}} ` +
                `k={repel:${repulsionEvery} coll:${collisionEvery} spring:${springsEvery} ` +
                `space:${spacingEvery} tri:${triangleEvery} safety:${safetyEvery} micro:${microEvery}} ` +
                `pairBudget={pairStride:${pairStrideBase} spacingStride:${spacingStride} smoothScale=${(budgetState._currentBudgetScale ?? 1.0).toFixed(2)}}`
            );
        }
    }

    if (engine.perfMode === 'fatal') {
        // FIX #10: Fatal Mode Containment
        // Even in fatal mode, we MUST apply boundary constraints to prevent
        // the graph from drifting off-screen or exploding.
        applyBoundaryForce(nodeList, engine.config, engine.worldWidth, engine.worldHeight);

        for (const node of nodeList) {
            // We do NOT clear forces here if we just applied boundary force!
            // We only clear the *other* forces by not calculating them.
            // But wait, applyBoundaryForce ADDS to fx/fy.
            // So we should clear first.
            node.fx = 0;
            node.fy = 0;
        }
        // Re-apply boundary force AFTER clearing (oops, the order above was wrong)
        // Let's do: Clear -> Apply Boundary -> Integrate.

        // Correct Order:
        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }
        applyBoundaryForce(nodeList, engine.config, engine.worldWidth, engine.worldHeight);

        applyDragVelocity(engine as any, nodeList, dt, debugStats);
        applyPreRollVelocity(engine as any, nodeList, preRollActive, debugStats);
        integrateNodes(engine as any, nodeList, dt, energy, motionPolicy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive, false);
        engine.lastDebugStats = debugStats;
        if (perfEnabled && frameTiming) {
            frameTiming.totalMs = getNowMs() - tickStart;
        }
        return;
    }

    let focusActive: PhysicsNode[] = [];
    let focusSleeping: PhysicsNode[] = [];
    const focusCenterId = engine.draggedNodeId ?? engine.lastDraggedNodeId;
    if (localBoostActive && focusCenterId) {
        const focusIds = new Set<string>();
        focusIds.add(focusCenterId);
        for (const link of engine.links) {
            if (link.source === focusCenterId) focusIds.add(link.target);
            if (link.target === focusCenterId) focusIds.add(link.source);
        }
        for (const node of nodeList) {
            if (focusIds.has(node.id)) {
                focusActive.push(node);
            } else {
                focusSleeping.push(node);
            }
        }
    }

    // 2. Apply Core Forces (scaled by energy)
    assertMode(engine, debugStats, 'applyForcePass');
    applyForcePass(
        engine as any,
        nodeList,
        engine.awakeList,
        engine.sleepingList,
        forceScale,
        dt,
        debugStats, // This is already passed as 7th arg. Check applyForcePass definition!
        preRollActive,
        energy,
        engine.frameIndex,
        frameTiming ?? undefined,
        perfEnabled ? getNowMs : undefined,
        pairStrideBase,
        pairOffset,
        repulsionEnabled,
        collisionEnabled,
        springsEnabled,
        localBoostActive && !repulsionEnabled ? focusActive : undefined,
        localBoostActive && !repulsionEnabled ? focusSleeping : undefined,
        localBoostActive && !repulsionEnabled,
        localBoostActive && !collisionEnabled,
        pairOffset + 7
    );
    measureFight('PostForces');
    measurePosSum('PostForces');

    currentEnergy = measureEnergy('PostForces', currentEnergy);

    if (!engine.config.debugDisableAllVMods) {
        applyDragVelocity(engine as any, nodeList, dt, debugStats);
        applyPreRollVelocity(engine as any, nodeList, preRollActive, debugStats);
    }
    currentEnergy = measureEnergy('PostVMods', currentEnergy); // Includes drag/preroll
    measureFight('PostVMods');
    measurePosSum('PostVMods');

    // 4. Integrate (always runs, never stops)
    integrateNodes(engine as any, nodeList, dt, energy, motionPolicy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive, false);
    currentEnergy = measureEnergy('PostInteg', currentEnergy);
    measureFight('PostInteg');
    measurePosSum('PostInteg');

    // =====================================================================
    // COMPUTE Dot DEGREES (needed early for degree-1 exclusion)
    // Degree-1 dots (dangling limbs) are excluded from positional corrections
    // =====================================================================
    const nodeDegreeEarly = computeNodeDegrees(engine as any, nodeList);

    if (!engine.config.debugDisableAllVMods) {
        applyExpansionResistance(engine as any, nodeList, nodeDegreeEarly, motionPolicy, debugStats, dt);
    }

    const microEnabled = engine.frameIndex % microEvery === 0;
    const quarantineActive = policyResult.quarantineStrength > 0.5;

    if (microEnabled && !engine.config.debugDisableAllVMods && !quarantineActive) {
        // FORENSIC: Enforced Allow-List for Startup Motors
        // During first 2.0s, we deny "stagnation escape" and "microslip"
        const denyStartupMotors = engine.lifecycle < 2.0;

        if (!engine.config.debugDisableMicroSlip) {
            // Dense-core velocity de-locking (micro-slip) - breaks rigid-body lock
            if (!denyStartupMotors) {
                assertMode(engine, debugStats, 'applyDenseCoreVelocityDeLocking');
                applyDenseCoreVelocityDeLocking(engine as any, nodeList, motionPolicy, debugStats);
            } else {
                if (debugStats) debugStats.microSlipDeniedByStartup = (debugStats.microSlipDeniedByStartup || 0) + 1;
            }
        }

        // Static friction bypass - breaks zero-velocity rest state
        assertMode(engine, debugStats, 'applyStaticFrictionBypass');
        applyStaticFrictionBypass(engine as any, nodeList, motionPolicy, debugStats);

        // Angular velocity decoherence - breaks velocity orientation correlation
        assertMode(engine, debugStats, 'applyAngularVelocityDecoherence');
        applyAngularVelocityDecoherence(engine as any, nodeList, motionPolicy, debugStats);

        // Local phase diffusion - breaks oscillation synchronization (shape memory eraser)
        assertMode(engine, debugStats, 'applyLocalPhaseDiffusion');
        applyLocalPhaseDiffusion(engine as any, nodeList, motionPolicy, debugStats);

        // Low-force stagnation escape - breaks rest-position preference (edge shear version)
        if (!denyStartupMotors) {
            assertMode(engine, debugStats, 'applyEdgeShearStagnationEscape');
            applyEdgeShearStagnationEscape(engine as any, nodeList, motionPolicy, debugStats);
        } else {
            if (debugStats) debugStats.escapeDeniedByStartup = (debugStats.escapeDeniedByStartup || 0) + 1;
        }

        // Dense-core inertia relaxation - erases momentum memory in jammed dots
        assertMode(engine, debugStats, 'applyDenseCoreInertiaRelaxation');
        applyDenseCoreInertiaRelaxation(engine as any, nodeList, motionPolicy, debugStats);

        currentEnergy = measureEnergy('PostMicro', currentEnergy);
        measureFight('PostMicro');
        measurePosSum('PostMicro');
    }

    // =====================================================================
    // PER-Dot CORRECTION BUDGET SYSTEM
    // All constraints request position corrections via accumulator
    // Total correction magnitude is clamped to prevent multi-constraint pileup
    // =====================================================================
    const pbdStart = perfEnabled ? getNowMs() : 0;
    const correctionAccum = initializeCorrectionAccum(nodeList, engine.correctionAccumCache, allocCounter);
    if (allocCounter) {
        engine.perfCounters.correctionNewEntries += allocCounter.newEntries;
    }

    if (!preRollActive) {
        const constraintsDisabled = !!engine.config.debugDisableConstraints;

        if (!constraintsDisabled) {
            const edgeRelaxEnabled = engine.frameIndex % edgeRelaxEvery === 0;
            if (edgeRelaxEnabled) {
                assertMode(engine, debugStats, 'applyEdgeRelaxation');
                applyEdgeRelaxation(engine as any, correctionAccum, nodeDegreeEarly, debugStats, dt);
            }
            if (spacingWillRun) {
                if (perfEnabled && frameTiming) {
                    const spacingStart = getNowMs();
                    assertMode(engine, debugStats, 'applySpacingConstraints');
                    applySpacingConstraints(
                        engine as any,
                        engine.awakeList,
                        engine.sleepingList,
                        correctionAccum,
                        nodeDegreeEarly,
                        motionPolicy,
                        debugStats,
                        spacingGate,
                        dt,
                        spacingStride,
                        pairOffset + 2,
                        1.0,
                        engine.spacingHotPairs
                    );
                    frameTiming.spacingMs += getNowMs() - spacingStart;
                } else {
                    applySpacingConstraints(
                        engine as any,
                        engine.awakeList,
                        engine.sleepingList,
                        correctionAccum,
                        nodeDegreeEarly,
                        motionPolicy,
                        debugStats,
                        spacingGate,
                        dt,
                        spacingStride,
                        pairOffset + 2,
                        1.0,
                        engine.spacingHotPairs
                    );
                }
            } else if (localBoostActive && focusActive.length > 0) {
                applySpacingConstraints(
                    engine as any,
                    focusActive,
                    focusSleeping,
                    correctionAccum,
                    nodeDegreeEarly,
                    motionPolicy,
                    debugStats,
                    spacingGate,
                    dt,
                    1,
                    pairOffset + 5
                );

            }
            // Fix: Law Continuity - Always run triangle pass, but scale strength internally
            const triangleEnabled = engine.frameIndex % triangleEvery === 0;
            if (triangleEnabled) {
                applyTriangleAreaConstraints(engine as any, nodeList, correctionAccum, nodeDegreeEarly, energy, motionPolicy, debugStats, dt);
            }
            applyAngleResistanceVelocity(engine as any, nodeList, nodeDegreeEarly, motionPolicy, debugStats, dt);

            // NOTE: DistanceBias is a Velocity Mod, but lives in constraints block?
            // Moving it to respect VMod flag if needed, but for now kept here.
            applyDistanceBiasVelocity(engine as any, nodeList, debugStats, dt);

            const safetyEnabled = engine.frameIndex % safetyEvery === 0;
            if (safetyEnabled) {
                applySafetyClamp(
                    engine as any,
                    engine.awakeList,
                    engine.sleepingList,
                    correctionAccum,
                    nodeDegreeEarly,
                    motionPolicy,
                    debugStats,
                    dt,
                    pairStrideBase,
                    pairOffset + 3
                );
            } else if (localBoostActive && focusActive.length > 0) {
                applySafetyClamp(
                    engine as any,
                    focusActive,
                    focusSleeping,
                    correctionAccum,
                    nodeDegreeEarly,
                    motionPolicy,
                    debugStats,
                    dt,
                    1,
                    pairOffset + 6
                );
            }
        } // End constraintsDisabled check

        measureFight('PostConstraints', correctionAccum);

        const reconcileDisabled = !!engine.config.debugDisableReconcile;
        const maxDiffusionNeighbors = engine.degradeLevel === 0 ? undefined : engine.degradeLevel === 1 ? 4 : 2;

        // FORENSICS: Snapshot Position/Velocity before Corrections
        let maxPosDeltaConstraint = 0;
        let maxVelDeltaConstraint = 0;
        let maxPrevGap = 0;
        const captureForensics = !engine.config.debugDisableConstraints && engine.frameIndex % 4 === 0;
        // reuse cache if possible, or just alloc (it's debug only)
        const forensicSnapshot = captureForensics ? new Float64Array(nodeList.length * 4) : null;

        if (forensicSnapshot) {
            for (let i = 0; i < nodeList.length; i++) {
                const n = nodeList[i];
                forensicSnapshot[i * 4 + 0] = n.x;
                forensicSnapshot[i * 4 + 1] = n.y;
                forensicSnapshot[i * 4 + 2] = n.vx;
                forensicSnapshot[i * 4 + 3] = n.vy;
            }
        }

        if (!engine.config.debugDisableDiffusion && !reconcileDisabled) {
            assertMode(engine, debugStats, 'applyCorrectionsWithDiffusion');
            applyCorrectionsWithDiffusion(
                engine as any,
                nodeList,
                correctionAccum,
                motionPolicy,
                spacingGate,
                debugStats,
                dt,
                maxDiffusionNeighbors
            );
        }

        // FORENSICS: Compare After
        if (forensicSnapshot) {
            for (let i = 0; i < nodeList.length; i++) {
                const n = nodeList[i];
                const prevX = forensicSnapshot[i * 4 + 0];
                const prevY = forensicSnapshot[i * 4 + 1];
                const prevVx = forensicSnapshot[i * 4 + 2];
                const prevVy = forensicSnapshot[i * 4 + 3];

                const dx = n.x - prevX;
                const dy = n.y - prevY;
                const dMag = Math.sqrt(dx * dx + dy * dy);
                if (dMag > maxPosDeltaConstraint) maxPosDeltaConstraint = dMag;

                const dvx = n.vx - prevVx;
                const dvy = n.vy - prevVy;
                const duMag = Math.sqrt(dvx * dvx + dvy * dvy);
                if (duMag > maxVelDeltaConstraint) maxVelDeltaConstraint = duMag;

                // Gap Check (Implicit History vs Actual)
                // If we assume LastGoodX is "History" (previous frame), Gap is |Pos - PrevPos|
                // But here we want |Pos - IntegratedPos| ? No, User said |pos - prevPos|.
                // If 'prevPos' means 'last frame', we use lastGoodX.
                if (Number.isFinite(n.lastGoodX)) {
                    const gx = n.x - (n.lastGoodX ?? n.x);
                    const gy = n.y - (n.lastGoodY ?? n.y);
                    const gMag = Math.sqrt(gx * gx + gy * gy);
                    if (gMag > maxPrevGap) maxPrevGap = gMag;
                }
            }
        }

        currentEnergy = measureEnergy('PostCorrect', currentEnergy);
        measurePosSum('PostCorrect');

        // Populate HUD
        engine.hudSnapshot.maxPosDeltaConstraint = maxPosDeltaConstraint;
        engine.hudSnapshot.maxVelDeltaConstraint = maxVelDeltaConstraint;
        engine.hudSnapshot.maxPrevGap = maxPrevGap;
        engine.hudSnapshot.postCorrectEnergy = currentEnergy;

        // Injectors
        engine.hudSnapshot.microSlipCount = debugStats.injectors.microSlipCount;
        engine.hudSnapshot.driftCount = debugStats.injectors.driftCount;
        engine.hudSnapshot.lastInjector = debugStats.injectors.lastInjector;

        measureFight('PostReconcile'); // Uses stats.conflict count
    }
    if (perfEnabled && frameTiming) {
        frameTiming.pbdMs += getNowMs() - pbdStart;
    }

    // FIX #9: Reset Correction Accumulators
    // Explicitly zero out the cache to prevent leftover drift in next tick
    if (engine.correctionAccumCache.size > 0) {
        for (const item of engine.correctionAccumCache.values()) {
            item.dx = 0;
            item.dy = 0;
        }
    }

    // FIX #7: Validation (Leak Check)
    if (perfEnabled && fixedSnapshots.size > 0) {
        for (const [id, snap] of fixedSnapshots) {
            const node = engine.nodes.get(id);
            if (node) {
                const dx = node.x - snap.x;
                const dy = node.y - snap.y;
                if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
                    console.warn(`[FixedLeakWarn] Node ${id} moved! dx=${dx.toFixed(6)} dy=${dy.toFixed(6)}`);
                    // Force reset to preserve contract
                    node.x = snap.x;
                    node.y = snap.y;
                }
            }
        }
    }



    // XPBD Frame Accumulation
    if (debugStats && debugStats.xpbd) {
        const accum = engine.xpbdFrameAccum;
        accum.ticks++;
        accum.dtSum += dt;
        accum.springs.count = debugStats.xpbd.springConstraintsCount;
        accum.springs.iter += debugStats.xpbd.springIterations;
        accum.springs.corrSum += debugStats.xpbd.springCorrAvgPx;
        accum.springs.errSum += debugStats.xpbd.springErrorAvgPx;

        accum.repel.checked += debugStats.xpbd.repelPairsChecked;
        accum.repel.solved += debugStats.xpbd.repelPairsSolved;
        accum.repel.overlap += debugStats.xpbd.overlapCount;
        accum.repel.corrSum += debugStats.xpbd.repelCorrAvgPx;
        accum.repel.sing += debugStats.xpbd.repelSingularityFallbackCount;
    }

    finalizePhysicsTick({
        engine,
        nodeList,
        localBoostActive,
        perfEnabled,
        debugStats,
        dtRawMs,
        energy,
        effectiveDamping,
        maxVelocityEffective,
        frameTiming,
        tickStart,
        spacingStride,
    });

    // FORENSICS: Store Constraint Vectors for Next Frame
    // (Used by Stagnation Escape to avoid fighting constraints)
    for (const [id, vec] of engine.correctionAccumCache) {
        const node = engine.nodes.get(id);
        if (node) {
            node.lastCorrectionX = vec.dx;
            node.lastCorrectionY = vec.dy;
        }
    }

    engine.lastDebugStats = debugStats;
};

import { runPhysicsTickXPBD } from './engineTickXPBD';

export const runPhysicsTick = (engine: PhysicsEngineTickContext, dtIn: number) => {
    if (engine.config.useXPBD) {
        runPhysicsTickXPBD(engine, dtIn);
    } else {
        runPhysicsTickLegacy(engine, dtIn);
    }
};
