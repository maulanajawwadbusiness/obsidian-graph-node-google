import type { PhysicsLink, PhysicsNode, ForceConfig } from '../types';
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
import { logEnergyDebug } from './debug';
import { createDebugStats, type DebugStats } from './stats';
import type { PhysicsHudHistory, PhysicsHudSnapshot } from './physicsHud';
import { getNowMs } from './engineTime';

export type PhysicsEngineTickContext = {
    nodes: Map<string, PhysicsNode>;
    links: PhysicsLink[];
    config: ForceConfig;
    draggedNodeId: string | null;
    dragTarget: { x: number; y: number } | null;
    awakeList: PhysicsNode[];
    sleepingList: PhysicsNode[];
    lifecycle: number;
    frameIndex: number;
    preRollFrames: number;
    hasFiredImpulse: boolean;
    localBoostFrames: number;
    spacingGate: number;
    spacingGateActive: boolean;
    // FIX 44: Idle Rest Mode
    idleFrames: number;
    spacingHotPairs: Set<string>;
    perfMode: 'normal' | 'stressed' | 'emergency' | 'fatal';
    perfModeLogAt: number;
    spacingLogAt: number;
    passLogAt: number;
    degradeLevel: number;
    degradeReason: string;
    degradeSeverity: 'NONE' | 'SOFT' | 'HARD';
    degradeBudgetMs: number;
    degradeLogAt: number;
    handLogAt: number;
    dragLagSamples: number[];
    lastDraggedNodeId: string | null;
    correctionAccumCache: Map<string, { dx: number; dy: number }>;
    // Fix: Startup Stats
    startupStats: {
        nanCount: number;
        infCount: number;
        maxSpeed: number;
        dtClamps: number;
    };
    perfCounters: {
        nodeListBuilds: number;
        correctionNewEntries: number;
        topologySkipped: number;
        topologyDuplicates: number;
    };
    perfTiming: {
        lastReportAt: number;
        frameCount: number;
        totals: {
            repulsionMs: number;
            collisionMs: number;
            springsMs: number;
            spacingMs: number;
            pbdMs: number;
            totalMs: number;
        };
    };
    lastDebugStats: DebugStats | null;
    hudSnapshot: PhysicsHudSnapshot;
    hudHistory: PhysicsHudHistory;
    hudSettleState: PhysicsHudSnapshot['settleState'];
    hudSettleStateAt: number;
    worldWidth: number;
    worldHeight: number;
    getNodeList: () => PhysicsNode[];
    requestImpulse: () => void;
    // Fix: Kill-Switches
    debugDisableDiffusion?: boolean;
    debugDisableMicroSlip?: boolean;
    debugDisableRepulsion?: boolean;
};

const computePairStride = (nodeCount: number, targetChecks: number, maxStride: number) => {
    if (nodeCount < 2) return 1;
    const pairCount = (nodeCount * (nodeCount - 1)) / 2;
    const safeTarget = Math.max(1, targetChecks);
    const stride = Math.ceil(pairCount / safeTarget);
    return Math.max(1, Math.min(maxStride, stride));
};



export const runPhysicsTick = (engine: PhysicsEngineTickContext, dtIn: number) => {
    // FIX: Startup Safety - Clamp DT for first 2 seconds to prevent insertion shock
    // If the browser hung during setup, dt could be 100ms+.
    // We clamp to 32ms (approx 30fps) during startup, then 64ms normal cap.
    const isStartup = engine.lifecycle < 2.0;

    const nodeList = engine.getNodeList();
    // Safety Firewall: NaN/Inf check + velocity clamp (always-on)
    // Run BEFORE tick to catch bad state entering the frame.
    const maxVelocityClamp = engine.config.maxVelocity * 1.5;
    const maxVelocitySq = maxVelocityClamp * maxVelocityClamp;
    let nanCount = 0;
    let infCount = 0;
    let maxSpeedSq = 0;
    let velClampCount = 0;

    for (const node of nodeList) {
        const finiteX = Number.isFinite(node.x);
        const finiteY = Number.isFinite(node.y);
        const finiteVx = Number.isFinite(node.vx);
        const finiteVy = Number.isFinite(node.vy);
        if (!finiteX || !finiteY || !finiteVx || !finiteVy) {
            const hasNaN =
                Number.isNaN(node.x) || Number.isNaN(node.y) ||
                Number.isNaN(node.vx) || Number.isNaN(node.vy);
            if (hasNaN) {
                nanCount++;
            } else {
                infCount++;
            }
            engine.firewallStats.nanResets += 1;

            if (
                Number.isFinite(node.lastGoodX) &&
                Number.isFinite(node.lastGoodY) &&
                Number.isFinite(node.lastGoodVx) &&
                Number.isFinite(node.lastGoodVy)
            ) {
                node.x = node.lastGoodX as number;
                node.y = node.lastGoodY as number;
                node.vx = node.lastGoodVx as number;
                node.vy = node.lastGoodVy as number;
            } else {
                node.x = 0;
                node.y = 0;
                node.vx = 0;
                node.vy = 0;
            }
            node.fx = 0;
            node.fy = 0;
            continue;
        }

        const speedSq = node.vx * node.vx + node.vy * node.vy;
        if (speedSq > maxVelocitySq && maxVelocityClamp > 0) {
            const speed = Math.sqrt(speedSq);
            if (speed > 0) {
                const scale = maxVelocityClamp / speed;
                node.vx *= scale;
                node.vy *= scale;
                velClampCount += 1;
                engine.firewallStats.velClamps += 1;
            }
        }
        if (speedSq > maxSpeedSq) maxSpeedSq = speedSq;
    }

    if (nanCount + infCount > 0) {
        console.warn(
            `[PhysicsFirewall] nonFinite=${nanCount + infCount} ` +
            `nan=${nanCount} inf=${infCount} t=${engine.lifecycle.toFixed(2)}`
        );
    }
    if (velClampCount > 0) {
        console.warn(
            `[PhysicsFirewall] velClamp=${velClampCount} ` +
            `cap=${maxVelocityClamp.toFixed(1)} t=${engine.lifecycle.toFixed(2)}`
        );
    }
    if (isStartup) {
        engine.startupStats.nanCount += nanCount;
        engine.startupStats.infCount += infCount;
        const maxSpeed = Math.sqrt(maxSpeedSq);
        if (maxSpeed > engine.startupStats.maxSpeed) {
            engine.startupStats.maxSpeed = maxSpeed;
        }
    }

    // Input DT clamping
    let dt = dtIn;
    const maxDt = Math.min(isStartup ? 0.032 : 0.064, engine.config.maxFrameDeltaMs / 1000);
    if (dt > maxDt) {
        dt = maxDt;
        engine.firewallStats.dtClamps += 1;
        if (isStartup) engine.startupStats.dtClamps++;
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


    const updateHudSnapshot = (
        nowMs: number,
        nodes: PhysicsNode[],
        stats: DebugStats,
        settleStateOverride?: PhysicsHudSnapshot['settleState']
    ) => {
        const nodeCount = nodes.length || 1;
        let avgVelSq = 0;
        for (const node of nodes) {
            avgVelSq += node.vx * node.vx + node.vy * node.vy;
        }
        avgVelSq /= nodeCount;

        const corrections = stats.passes.Corrections?.correction ?? 0;
        const jitterSample = nodeCount > 0 ? corrections / nodeCount : 0;
        const conflictFrame = stats.correctionConflictCount > 0;

        const pruneWindow = <T extends { t: number }>(arr: T[], windowMs: number) => {
            const cutoff = nowMs - windowMs;
            while (arr.length > 0 && arr[0].t < cutoff) {
                arr.shift();
            }
        };

        engine.hudHistory.degradeFrames.push({ t: nowMs, degraded: engine.degradeLevel > 0 });
        engine.hudHistory.conflictFrames.push({ t: nowMs, conflict: conflictFrame });
        engine.hudHistory.jitterSamples.push({ t: nowMs, value: jitterSample });

        pruneWindow(engine.hudHistory.degradeFrames, 5000);
        pruneWindow(engine.hudHistory.conflictFrames, 5000);
        pruneWindow(engine.hudHistory.jitterSamples, 1000);

        const degradeFrames = engine.hudHistory.degradeFrames.length || 1;
        const degradeHits = engine.hudHistory.degradeFrames.filter(sample => sample.degraded).length;
        const conflictFrames = engine.hudHistory.conflictFrames.length || 1;
        const conflictHits = engine.hudHistory.conflictFrames.filter(sample => sample.conflict).length;
        const jitterSamples = engine.hudHistory.jitterSamples;
        const jitterAvg = jitterSamples.length > 0
            ? jitterSamples.reduce((sum, sample) => sum + sample.value, 0) / jitterSamples.length
            : 0;

        let settleState: PhysicsHudSnapshot['settleState'];
        if (settleStateOverride) {
            settleState = settleStateOverride;
        } else if (avgVelSq > 0.25) {
            settleState = 'moving';
        } else if (avgVelSq > 0.04) {
            settleState = 'cooling';
        } else if (avgVelSq > 0.0004) {
            settleState = 'microkill';
        } else {
            settleState = 'microkill';
        }

        if (settleState !== engine.hudSettleState) {
            engine.hudSettleState = settleState;
            engine.hudSettleStateAt = nowMs;
        }

        engine.hudSnapshot = {
            degradeLevel: engine.degradeLevel,
            degradePct5s: degradeHits > 0 ? (degradeHits / degradeFrames) * 100 : 0,
            settleState,
            lastSettleMs: Math.max(0, nowMs - engine.hudSettleStateAt),
            jitterAvg,
            pbdCorrectionSum: corrections,
            conflictPct5s: conflictHits > 0 ? (conflictHits / conflictFrames) * 100 : 0,
            energyProxy: avgVelSq,
            startupNanCount: engine.startupStats.nanCount,
            startupInfCount: engine.startupStats.infCount,
            startupMaxSpeed: engine.startupStats.maxSpeed,
            startupDtClamps: engine.startupStats.dtClamps,
        };
    };

    engine.awakeList.length = 0;
    engine.sleepingList.length = 0;
    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        node.listIndex = i;
        const isSleeping = (node.isFixed || node.isSleeping === true) && node.id !== engine.draggedNodeId;
        if (isSleeping) {
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
    // Velocity Sensor
    let totalVelSq = 0;
    for (const node of nodeList) {
        totalVelSq += node.vx * node.vx + node.vy * node.vy;
    }
    const nodeCount = nodeList.length || 1;
    const avgVelSq = totalVelSq / nodeCount;

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
    const { energy, forceScale, effectiveDamping, maxVelocityEffective } = computeEnergyEnvelope(engine.lifecycle);
    const allowEarlyExpansion = engine.config.initStrategy === 'legacy' && engine.config.debugAllowEarlyExpansion === true;
    const motionPolicy = createMotionPolicy(energy, engine.degradeLevel, avgVelSq, allowEarlyExpansion);

    // =====================================================================
    // 2. SETTLE (Continuous Rest)
    // =====================================================================
    if (motionPolicy.settleScalar > 0.99 && !localBoostActive) {
        engine.idleFrames++;
        if (engine.idleFrames > 10) {
            for (const node of nodeList) {
                node.vx = 0; node.vy = 0;
                node.fx = 0; node.fy = 0;
            }
            updateHudSnapshot(getNowMs(), nodeList, debugStats, 'sleep');
            return;
        }
    } else if (engine.lifecycle < 2.0 && motionPolicy.settleScalar < 0.99) {
        // Fix: Startup Safety - Do not accumulate idle frames during first 2s if moving
        engine.idleFrames = 0;
    } else {
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
        engine.requestImpulse();
    }

    advanceEscapeWindow(engine as any);

    // Budget Scaling for Spacing/Constraint checks
    const budgetScale = 1.0 - (motionPolicy.degradeScalar * 0.8);
    // Legacy support for budgetState._currentBudgetScale
    budgetState._currentBudgetScale = budgetScale;
    const pairBudgetScale = budgetScale;

    const pairStrideBase = pairBudgetScale > 0
        ? computePairStride(
            nodeList.length,
            engine.config.pairwiseMaxChecks * pairBudgetScale,
            engine.config.pairwiseMaxStride
        )
        : engine.config.pairwiseMaxStride;
    const pairOffset = engine.frameIndex;

    const spacingGateOn = engine.config.spacingGateOnEnergy;
    const spacingGateOff = engine.config.spacingGateOffEnergy;
    if (engine.spacingGateActive) {
        if (energy > spacingGateOff) engine.spacingGateActive = false;
    } else if (energy < spacingGateOn) {
        engine.spacingGateActive = true;
    }

    let spacingGateTarget = 0;
    if (engine.spacingGateActive) {
        const rampStart = engine.config.spacingGateRampStart;
        const rampEnd = engine.config.spacingGateRampEnd;
        const denom = Math.max(0.0001, rampStart - rampEnd);
        const gateT = Math.max(0, Math.min(1, (rampStart - energy) / denom));
        spacingGateTarget = gateT * gateT * (3 - 2 * gateT);
    }

    const spacingGateRise = 1 - Math.exp(-dt / engine.config.spacingGateRiseTime);
    engine.spacingGate += (spacingGateTarget - engine.spacingGate) * spacingGateRise;
    const spacingGate = engine.spacingGate;
    const spacingEnabled = spacingGate > engine.config.spacingGateEnableThreshold;
    let spacingStride = pairStrideBase;
    if (spacingEnabled) {
        const scaledTarget = engine.config.pairwiseMaxChecks * spacingGate;
        spacingStride = computePairStride(
            nodeList.length,
            scaledTarget,
            engine.config.pairwiseMaxStride
        );
    }

    const cascadeActive = false;
    const cascadePhase = 0;

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
        integrateNodes(engine as any, nodeList, dt, energy, motionPolicy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive);
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
    applyForcePass(
        engine as any,
        nodeList,
        engine.awakeList,
        engine.sleepingList,
        forceScale,
        dt,
        debugStats,
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

    currentEnergy = measureEnergy('PostForces', currentEnergy);

    if (!engine.config.debugDisableAllVMods) {
        applyDragVelocity(engine as any, nodeList, dt, debugStats);
        applyPreRollVelocity(engine as any, nodeList, preRollActive, debugStats);
    }
    currentEnergy = measureEnergy('PostVMods', currentEnergy); // Includes drag/preroll
    measureFight('PostVMods');

    // 4. Integrate (always runs, never stops)
    integrateNodes(engine as any, nodeList, dt, energy, motionPolicy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive);
    currentEnergy = measureEnergy('PostInteg', currentEnergy);
    measureFight('PostInteg');

    // =====================================================================
    // COMPUTE Dot DEGREES (needed early for degree-1 exclusion)
    // Degree-1 dots (dangling limbs) are excluded from positional corrections
    // =====================================================================
    const nodeDegreeEarly = computeNodeDegrees(engine as any, nodeList);

    if (!engine.config.debugDisableAllVMods) {
        applyExpansionResistance(engine as any, nodeList, nodeDegreeEarly, motionPolicy, debugStats, dt);
    }

    const microEnabled = engine.frameIndex % microEvery === 0;
    if (microEnabled && !engine.config.debugDisableAllVMods) {
        if (!engine.config.debugDisableMicroSlip) {
            // Dense-core velocity de-locking (micro-slip) - breaks rigid-body lock
            applyDenseCoreVelocityDeLocking(engine as any, nodeList, motionPolicy, debugStats);
        }

        // Static friction bypass - breaks zero-velocity rest state
        applyStaticFrictionBypass(engine as any, nodeList, motionPolicy, debugStats);

        // Angular velocity decoherence - breaks velocity orientation correlation
        applyAngularVelocityDecoherence(engine as any, nodeList, motionPolicy, debugStats);

        // Local phase diffusion - breaks oscillation synchronization (shape memory eraser)
        applyLocalPhaseDiffusion(engine as any, nodeList, motionPolicy, debugStats);

        // Low-force stagnation escape - breaks rest-position preference (edge shear version)
        applyEdgeShearStagnationEscape(engine as any, nodeList, motionPolicy, debugStats);

        // Dense-core inertia relaxation - erases momentum memory in jammed dots
        applyDenseCoreInertiaRelaxation(engine as any, nodeList, motionPolicy, debugStats);

        currentEnergy = measureEnergy('PostMicro', currentEnergy);
        measureFight('PostMicro');
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
                applyEdgeRelaxation(engine as any, correctionAccum, nodeDegreeEarly, debugStats, dt);
            }
            if (spacingWillRun) {
                if (perfEnabled && frameTiming) {
                    const spacingStart = getNowMs();
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
            const triangleEnabled = (engine.perfMode === 'normal' || engine.perfMode === 'stressed') &&
                engine.frameIndex % triangleEvery === 0;
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

        if (!engine.config.debugDisableDiffusion && !reconcileDisabled) {
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
        currentEnergy = measureEnergy('PostCorrect', currentEnergy);
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

    // FIX 1: Per-Node Sleep Detection (Canonical)
    // Run after all forces/corrections/integration are final.
    const restSpeedSq = 0.001;
    const restFramesRequired = 60;
    let sleepCandidates = 0;

    for (const node of nodeList) {
        // Authority nodes are never sleeping (they are user-controlled)
        if (node.isFixed || node.id === engine.draggedNodeId) {
            node.sleepFrames = 0;
            node.isSleeping = false;
            continue;
        }

        const speedSq = node.vx * node.vx + node.vy * node.vy;
        if (speedSq < restSpeedSq) {
            node.sleepFrames = (node.sleepFrames || 0) + 1;
            sleepCandidates++;
        } else {
            node.sleepFrames = 0;
            node.isSleeping = false;
        }

        if (node.sleepFrames >= restFramesRequired) {
            node.isSleeping = true;
        }
    }

    // Wire hudSettleState to engine for external access (Fix 2)
    // (Already satisfied by updateHudSnapshot logic above, but ensure it sticks)
    if (engine.draggedNodeId && engine.dragTarget) {
        const node = engine.nodes.get(engine.draggedNodeId);
        if (node) {
            const dx = node.x - engine.dragTarget.x;
            const dy = node.y - engine.dragTarget.y;
            const lag = Math.sqrt(dx * dx + dy * dy);
            engine.dragLagSamples.push(lag);
        }
    }

    if (perfEnabled) {
        const now = getNowMs();
        if (now - engine.handLogAt >= 1000) {
            engine.handLogAt = now;
            let lagP95 = 0;
            if (engine.dragLagSamples.length > 0) {
                const sorted = engine.dragLagSamples.slice().sort((a, b) => a - b);
                const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
                lagP95 = sorted[idx] ?? 0;
            }
            console.log(
                `[Hand] dragging=${engine.draggedNodeId ? 'Y' : 'N'} ` +
                `localBoost=${localBoostActive ? 'Y' : 'N'} ` +
                `lagP95Px=${lagP95.toFixed(2)}`
            );
            engine.dragLagSamples.length = 0;
        }
    }

    logEnergyDebug(engine.lifecycle, energy, effectiveDamping, maxVelocityEffective);
    engine.lastDebugStats = debugStats;
    updateHudSnapshot(getNowMs(), nodeList, debugStats);

    // Firewall: refresh last-good state after a clean tick
    for (const node of nodeList) {
        if (
            Number.isFinite(node.x) &&
            Number.isFinite(node.y) &&
            Number.isFinite(node.vx) &&
            Number.isFinite(node.vy)
        ) {
            node.lastGoodX = node.x;
            node.lastGoodY = node.y;
            node.lastGoodVx = node.vx;
            node.lastGoodVy = node.vy;
        }
    }

    if (perfEnabled && frameTiming) {
        const tickEnd = getNowMs();
        frameTiming.totalMs = tickEnd - tickStart;

        const perf = engine.perfTiming;
        perf.frameCount += 1;
        perf.totals.repulsionMs += frameTiming.repulsionMs;
        perf.totals.collisionMs += frameTiming.collisionMs;
        perf.totals.springsMs += frameTiming.springsMs;
        perf.totals.spacingMs += frameTiming.spacingMs;
        perf.totals.pbdMs += frameTiming.pbdMs;
        perf.totals.totalMs += frameTiming.totalMs;

        if (perf.lastReportAt === 0) {
            perf.lastReportAt = tickEnd;
        }
        const elapsed = tickEnd - perf.lastReportAt;
        if (elapsed >= 1000) {
            const frames = perf.frameCount || 1;
            const avg = (value: number) => (value / frames).toFixed(3);
            console.log(
                `[PhysicsPerf] avgMs repulsion=${avg(perf.totals.repulsionMs)} ` +
                `collision=${avg(perf.totals.collisionMs)} ` +
                `springs=${avg(perf.totals.springsMs)} ` +
                `spacing=${avg(perf.totals.spacingMs)} ` +
                `pbd=${avg(perf.totals.pbdMs)} ` +
                `total=${avg(perf.totals.totalMs)} ` +
                `nodes=${nodeList.length} ` +
                `links=${engine.links.length} ` +
                `mode=${engine.perfMode} ` +
                `allocs=${engine.perfCounters.nodeListBuilds + engine.perfCounters.correctionNewEntries} ` +
                `topoDrop=${engine.perfCounters.topologySkipped} ` +
                `topoDup=${engine.perfCounters.topologyDuplicates} ` +
                `frames=${frames}`
            );
            perf.frameCount = 0;
            perf.totals.repulsionMs = 0;
            perf.totals.collisionMs = 0;
            perf.totals.springsMs = 0;
            perf.totals.spacingMs = 0;
            perf.totals.pbdMs = 0;
            perf.totals.totalMs = 0;
            perf.lastReportAt = tickEnd;
            engine.perfCounters.nodeListBuilds = 0;
            engine.perfCounters.correctionNewEntries = 0;
            engine.perfCounters.topologySkipped = 0;
            engine.perfCounters.topologyDuplicates = 0;
        }
    }
};
