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
import { updateFeelMetrics, type FeelMetricsState } from './feelMetrics';
import { createDebugStats, type DebugStats } from './stats';
import { getNowMs } from './engineTime';
import { capturePositionSnapshot, reconcileVelocityFromPositionDelta } from './positionVelocityReconcile';
import { computeUnifiedMotionState, type UnifiedMotionState } from './unifiedMotionState';
import { applySettleLadder, type SettleDebugStats } from './settleLadder';
import { computeInteractionAuthorityPolicy } from './interactionAuthority';
import { computeMotionPolicy, type MotionPolicy } from './motionPolicy';
import { maybeRunScaleHarness } from './scaleHarness';

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
    pbdReconLogAt: number;
    settleLogAt: number;
    degradeLevel: number;
    degradeReason: string;
    degradeSeverity: 'NONE' | 'SOFT' | 'HARD';
    degradeBudgetMs: number;
    degradeLogAt: number;
    handLogAt: number;
    dragLagSamples: number[];
    lastDraggedNodeId: string | null;
    feelMetrics: FeelMetricsState;
    correctionAccumCache: Map<string, { dx: number; dy: number }>;
    pbdReconcileCache: Float32Array;
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
    unifiedMotionState: UnifiedMotionState | null;
    motionPolicy: MotionPolicy | null;
    settleState: 'moving' | 'cooling' | 'microkill' | 'sleep';
    settleStateMs: number;
    settleJitterAvg: number;
    settlePositionCache: Float32Array;
    localBoostStrength: number;
    localBoostRadius: number;
    scaleHarnessRan: boolean;
    worldWidth: number;
    worldHeight: number;
    getNodeList: () => PhysicsNode[];
    requestImpulse: () => void;
};

const computePairStride = (nodeCount: number, targetChecks: number, maxStride: number) => {
    if (nodeCount < 2) return 1;
    const pairCount = (nodeCount * (nodeCount - 1)) / 2;
    const safeTarget = Math.max(1, targetChecks);
    const stride = Math.ceil(pairCount / safeTarget);
    return Math.max(1, Math.min(maxStride, stride));
};

const updatePerfMode = (engine: PhysicsEngineTickContext, nodeCount: number, linkCount: number) => {
    const downshift = engine.config.perfModeDownshiftRatio;
    const nextMode = (n: number, e: number) => {
        if (n >= engine.config.perfModeNFatal || e >= engine.config.perfModeEFatal) return 'fatal';
        if (n >= engine.config.perfModeNEmergency || e >= engine.config.perfModeEEmergency) return 'emergency';
        if (n >= engine.config.perfModeNStressed || e >= engine.config.perfModeEStressed) return 'stressed';
        return 'normal';
    };

    const desired = nextMode(nodeCount, linkCount);
    if (desired === engine.perfMode) return;

    const downshiftThresholds = {
        stressed: {
            n: engine.config.perfModeNStressed * downshift,
            e: engine.config.perfModeEStressed * downshift,
        },
        emergency: {
            n: engine.config.perfModeNEmergency * downshift,
            e: engine.config.perfModeEEmergency * downshift,
        },
        fatal: {
            n: engine.config.perfModeNFatal * downshift,
            e: engine.config.perfModeEFatal * downshift,
        },
    };

    const allowDownshift = (mode: 'stressed' | 'emergency' | 'fatal') => {
        const thresholds = downshiftThresholds[mode];
        return nodeCount < thresholds.n && linkCount < thresholds.e;
    };

    let newMode = engine.perfMode;
    if (desired === 'fatal') {
        newMode = 'fatal';
    } else if (desired === 'emergency') {
        if (engine.perfMode === 'fatal') {
            if (allowDownshift('fatal')) newMode = 'emergency';
        } else {
            newMode = 'emergency';
        }
    } else if (desired === 'stressed') {
        if (engine.perfMode === 'fatal') {
            if (allowDownshift('fatal')) newMode = 'emergency';
        }
        if (newMode === 'emergency' && allowDownshift('emergency')) {
            newMode = 'stressed';
        }
        if (engine.perfMode === 'normal') newMode = 'stressed';
    } else {
        if (engine.perfMode === 'fatal' && allowDownshift('fatal')) newMode = 'emergency';
        if (newMode === 'emergency' && allowDownshift('emergency')) newMode = 'stressed';
        if (newMode === 'stressed' && allowDownshift('stressed')) newMode = 'normal';
    }

    if (newMode !== engine.perfMode) {
        engine.perfMode = newMode;
        const now = getNowMs();
        if (now - engine.perfModeLogAt > 500) {
            engine.perfModeLogAt = now;
            console.log(`[PhysicsMode] mode=${engine.perfMode} nodes=${nodeCount} links=${linkCount}`);
        }
    }

    if (engine.perfMode === 'fatal') {
        const now = getNowMs();
        if (now - engine.perfModeLogAt > 1000) {
            engine.perfModeLogAt = now;
            console.log(`[PhysicsFatal] nodes=${nodeCount} links=${linkCount} mode=fatal`);
        }
    }
};

export const runPhysicsTick = (engine: PhysicsEngineTickContext, dt: number) => {
    const nodeList = engine.getNodeList();
    const budgetState = engine as PhysicsEngineTickContext & { _currentBudgetScale?: number };

    if (engine.config.debugPerf) {
        maybeRunScaleHarness(engine as any);
    }

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
    engine.lifecycle += dt;
    engine.frameIndex++;

    updatePerfMode(engine, nodeList.length, engine.links.length);
    const degradeLevel = engine.degradeLevel;
    const interactionPolicy = engine.motionPolicy
        ? computeInteractionAuthorityPolicy(engine.motionPolicy, null)
        : null;
    if (engine.draggedNodeId) {
        engine.localBoostFrames = Math.max(engine.localBoostFrames, interactionPolicy?.localBoostFrames ?? 8);
    } else if (engine.localBoostFrames > 0) {
        engine.localBoostFrames -= 1;
    }
    const localBoostActive = engine.localBoostFrames > 0;
    if (!engine.draggedNodeId && engine.localBoostFrames === 0) {
        engine.lastDraggedNodeId = null;
    }

    // =====================================================================
    // FIX 44: SOLVER COMA (Idle Rest Mode)
    // If energy is negligible for > 1 second (60 ticks), we HARD FREEZE.
    // This stops all floating point noise and ensures "Dead" visual state.
    // =====================================================================
    const isInteracting = engine.draggedNodeId !== null || engine.localBoostFrames > 0;
    const isStartup = engine.lifecycle < 2.0; // Grace period for startup

    // We compute energy later, but we need it now? 
    // `computeEnergyEnvelope` returns "max allowed" not "current".
    // We have to rely on `engine.spacingGate` or similar proxies? 
    // Or just check if we are already in coma?
    // Actually `energy` (computed later) is the envelope (1.0 -> 0.0). 
    // It's ALWAYS > 0.05 for a long time. 
    // We want to check KINETIC energy (velocities).
    // Let's use `debugStats` later? No, we want to skip early.
    // Let's use the PREVIOUS frame's decision? 
    // Or just run a quick velocity scan.
    let maxVelSq = 0;
    if (!isInteracting && !isStartup) {
        for (const node of nodeList) {
            maxVelSq = Math.max(maxVelSq, node.vx * node.vx + node.vy * node.vy);
            if (maxVelSq > 0.001) break;
        }
    }

    if (!isInteracting && !isStartup && maxVelSq < 0.0001) {
        engine.idleFrames++;
    } else {
        engine.idleFrames = 0;
    }

    const restModeActive = engine.perfMode === 'fatal' && engine.idleFrames > 60; // emergency-only
    if (restModeActive) {
        // HARD SKIP
        // Zero out everything to be sure
        if (engine.idleFrames === 61) { // On entry, clamp hard
            for (const node of nodeList) {
                node.vx = 0;
                node.vy = 0;
                node.fx = 0;
                node.fy = 0;
            }
            if (engine.config.debugPerf) console.log('[PhysicsRest] Entered Coma');
        }
        return; // EXIT TICK
    }


    // =====================================================================
    // SOFT PRE-ROLL PHASE (Gentle separation before expansion)
    // Springs at 10%, spacing on, angle off, velocity-only corrections
    // Runs for ~5 frames before expansion starts
    // =====================================================================
    const preRollActive = engine.preRollFrames > 0 && !engine.hasFiredImpulse;
    if (preRollActive) {
        runPreRollPhase(engine, nodeList, debugStats);
    }

    // 0. FIRE IMPULSE (One Shot, Guarded)
    // FIX #11: Guarded Impulse Kick
    // Logic moved to requestImpulse() to enforce cooldowns and safeguards.
    // We only auto-fire if lifecycle is young and we haven't fired yet.
    if (!preRollActive && engine.lifecycle < 0.1 && !engine.hasFiredImpulse) {
        engine.requestImpulse();
    }

    advanceEscapeWindow(engine);

    // =====================================================================
    // EXPONENTIAL COOLING: Energy decays asymptotically, never stops
    // =====================================================================
    const { energy, forceScale, effectiveDamping, maxVelocityEffective } = computeEnergyEnvelope(engine.lifecycle);

    const degradePairScale = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 0.7 : 0.4;

    // FIX #9: SMOOTH MODE TRANSITIONS
    // Degrade touches cadence only (never stiffness/force laws).
    // Slew the budget scalar instead of snapping to prevent "law changes".
    const targetBudgetScale = (engine.perfMode === 'normal'
        ? 1
        : engine.perfMode === 'stressed'
            ? 0.7
            : engine.perfMode === 'emergency'
                ? 0.4
                : 0) * degradePairScale;

    // Initialize if undefined (first frame)
    if (budgetState._currentBudgetScale === undefined) {
        budgetState._currentBudgetScale = targetBudgetScale;
    }

    // Slew towards target (10% per frame)
    // This makes transitions take ~0.5s instead of 0s
    const slewRate = 0.1;
    const diff = targetBudgetScale - budgetState._currentBudgetScale;
    if (Math.abs(diff) > 0.001) {
        budgetState._currentBudgetScale += diff * slewRate;
    } else {
        budgetState._currentBudgetScale = targetBudgetScale;
    }

    const pairBudgetScale = budgetState._currentBudgetScale;

    const unifiedMotionState = computeUnifiedMotionState({
        energy,
        nodeCount: nodeList.length,
        linkCount: engine.links.length,
        sleepingCount: engine.sleepingList.length,
        draggedNodeId: engine.draggedNodeId,
        budgetScale: pairBudgetScale,
        config: engine.config,
    });
    engine.unifiedMotionState = unifiedMotionState;
    const motionPolicy = computeMotionPolicy(unifiedMotionState, engine.config, maxVelocityEffective);
    engine.motionPolicy = motionPolicy;
    const authorityPolicy = computeInteractionAuthorityPolicy(motionPolicy, null);
    engine.localBoostStrength = authorityPolicy.localBoostStrength;
    engine.localBoostRadius = authorityPolicy.localBoostRadius;

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

    const cascadeActive = spacingEnabled && spacingGate >= engine.config.spacingCascadeGate && pairStrideBase > 1;
    const cascadeModulo = engine.config.spacingCascadePhaseModulo;
    const cascadePhase = cascadeModulo > 0 ? engine.frameIndex % cascadeModulo : 0;
    const spacingPhase = engine.config.spacingCascadeSpacingPhase;
    const spacingPhaseActive = !cascadeActive || cascadePhase === spacingPhase;
    const runPairwiseForces = !cascadeActive || cascadePhase !== spacingPhase;
    const spacingEveryBase = engine.perfMode === 'normal'
        ? 1
        : engine.perfMode === 'stressed'
            ? 2
            : 4;
    const spacingEvery = spacingEveryBase * (degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3);
    const spacingWillRun = spacingEnabled && spacingPhaseActive && engine.frameIndex % spacingEvery === 0;
    const repulsionEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
    const collisionEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
    const springsEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
    const baseSpringsEnabled = engine.perfMode !== 'emergency' || engine.frameIndex % 2 === 0;
    const springsEnabled = baseSpringsEnabled && engine.frameIndex % springsEvery === 0;

    const triangleEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 4;
    const safetyEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
    const edgeRelaxEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
    const microEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 4;

    const repulsionEnabled = runPairwiseForces && engine.frameIndex % repulsionEvery === 0;
    const collisionEnabled = runPairwiseForces && (engine.frameIndex + 1) % collisionEvery === 0;

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
            const skippedPasses = [
                !repulsionEnabled ? 'repel' : null,
                !collisionEnabled ? 'coll' : null,
                !springsEnabled ? 'spring' : null,
                !spacingWillRun ? 'space' : null,
                !microEnabled ? 'micro' : null,
                !((engine.perfMode === 'normal' || engine.perfMode === 'stressed') && engine.frameIndex % triangleEvery === 0)
                    ? 'tri'
                    : null,
                !(engine.frameIndex % safetyEvery === 0) ? 'safety' : null,
            ].filter(Boolean);
            console.log(
                `[Degrade] level=${degradeLevel} ` +
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
            console.log(
                `[DegradeSummary] budgetScale=${(pairBudgetScale ?? 0).toFixed(2)} ` +
                `level=${degradeLevel} ` +
                `skippedPasses=${skippedPasses.length} ` +
                `passList=${skippedPasses.join(',') || 'none'}`
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

        applyDragVelocity(engine, nodeList, dt, debugStats);
        applyPreRollVelocity(engine, nodeList, preRollActive, debugStats);
        integrateNodes(engine, nodeList, dt, energy, unifiedMotionState, motionPolicy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive);
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
        1,
        pairOffset + 7
    );
    applyDragVelocity(engine as any, nodeList, dt, debugStats);
    applyPreRollVelocity(engine as any, nodeList, preRollActive, debugStats);

    // 4. Integrate (always runs, never stops)
    integrateNodes(engine as any, nodeList, dt, energy, unifiedMotionState, motionPolicy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive);

    // =====================================================================
    // COMPUTE Dot DEGREES (needed early for degree-1 exclusion)
    // Degree-1 dots (dangling limbs) are excluded from positional corrections
    // =====================================================================
    const nodeDegreeEarly = computeNodeDegrees(engine as any, nodeList);

    applyExpansionResistance(engine as any, nodeList, nodeDegreeEarly, energy, debugStats, dt);

    const microEnabled = engine.frameIndex % microEvery === 0 &&
        engine.settleState !== 'microkill' &&
        engine.settleState !== 'sleep';
    if (microEnabled) {
        // Dense-core velocity de-locking (micro-slip) - breaks rigid-body lock
        applyDenseCoreVelocityDeLocking(engine as any, nodeList, unifiedMotionState, motionPolicy, debugStats);

        // Static friction bypass - breaks zero-velocity rest state
        applyStaticFrictionBypass(engine as any, nodeList, unifiedMotionState, motionPolicy, debugStats);

        // Angular velocity decoherence - breaks velocity orientation correlation
        applyAngularVelocityDecoherence(engine as any, nodeList, energy, motionPolicy, debugStats);

        // Local phase diffusion - breaks oscillation synchronization (shape memory eraser)
        applyLocalPhaseDiffusion(engine as any, nodeList, energy, debugStats);

        // Low-force stagnation escape - breaks rest-position preference (edge shear version)
        applyEdgeShearStagnationEscape(engine as any, nodeList, energy, motionPolicy, debugStats);

        // Dense-core inertia relaxation - erases momentum memory in jammed dots
        applyDenseCoreInertiaRelaxation(engine as any, nodeList, energy, motionPolicy, debugStats);
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
    engine.pbdReconcileCache = capturePositionSnapshot(nodeList, engine.pbdReconcileCache);
    let pbdReconStats = { pbdDeltaSum: 0, vReconAppliedSum: 0 };

    if (!preRollActive) {
        const edgeRelaxEnabled = engine.frameIndex % edgeRelaxEvery === 0;
        if (edgeRelaxEnabled) {
            applyEdgeRelaxation(engine, correctionAccum, nodeDegreeEarly, debugStats, dt);
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
                    energy,
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
                    energy,
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
                energy,
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
            applyTriangleAreaConstraints(engine as any, nodeList, correctionAccum, nodeDegreeEarly, energy, debugStats, dt);
        }
        applyAngleResistanceVelocity(engine as any, nodeList, nodeDegreeEarly, energy, debugStats, dt);
        applyDistanceBiasVelocity(engine as any, nodeList, debugStats, dt);
        const safetyEnabled = engine.frameIndex % safetyEvery === 0;
        if (safetyEnabled) {
            applySafetyClamp(
                engine as any,
                engine.awakeList,
                engine.sleepingList,
                correctionAccum,
                nodeDegreeEarly,
                energy,
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
                energy,
                debugStats,
                dt,
                1,
                pairOffset + 6
            );
        }
        const maxDiffusionNeighbors = degradeLevel === 0 ? undefined : degradeLevel === 1 ? 4 : 2;
        applyCorrectionsWithDiffusion(
            engine as any,
            nodeList,
            correctionAccum,
            energy,
            spacingGate,
            debugStats,
            dt,
            maxDiffusionNeighbors
        );
        pbdReconStats = reconcileVelocityFromPositionDelta(
            nodeList,
            engine.pbdReconcileCache,
            dt,
            engine.draggedNodeId
        );
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

    if (perfEnabled) {
        const now = getNowMs();
        if (now - engine.pbdReconLogAt >= 1000) {
            engine.pbdReconLogAt = now;
            console.log(
                `[PhysicsPerf] pbdDeltaSum=${pbdReconStats.pbdDeltaSum.toFixed(3)} ` +
                `vReconAppliedSum=${pbdReconStats.vReconAppliedSum.toFixed(3)}`
            );
            console.log(
                `[DegradeSummary] budgetScale=${(pairBudgetScale ?? 0).toFixed(2)} ` +
                `level=${degradeLevel} ` +
                `pbdCorrections=${pbdReconStats.pbdDeltaSum.toFixed(3)}`
            );
        }
    }

    const settleStats: SettleDebugStats = applySettleLadder(
        engine as any,
        nodeList,
        unifiedMotionState,
        motionPolicy,
        dt,
        maxVelocityEffective
    );

    if (perfEnabled) {
        const now = getNowMs();
        if (now - engine.settleLogAt >= 1000) {
            engine.settleLogAt = now;
            console.log(
                `[Settle] state=${settleStats.settleState} ` +
                `timeToSleepMs=${settleStats.timeToSleepMs.toFixed(0)} ` +
                `jitterAvg=${settleStats.jitterAvg.toFixed(4)}`
            );
        }
    }

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

    if (perfEnabled) {
        const feelRepulsionEnabled = !preRollActive && repulsionEnabled;
        const feelCollisionEnabled = !preRollActive && collisionEnabled;
        const feelSpringsEnabled = !preRollActive && springsEnabled;
        const feelSpacingEnabled = !preRollActive && spacingWillRun;
        const feelTriangleEnabled = !preRollActive &&
            (engine.perfMode === 'normal' || engine.perfMode === 'stressed') &&
            engine.frameIndex % triangleEvery === 0;
        const feelSafetyEnabled = !preRollActive && engine.frameIndex % safetyEvery === 0;

        updateFeelMetrics(
            engine.feelMetrics,
            {
                config: engine.config,
                lifecycle: engine.lifecycle,
                links: engine.links,
                draggedNodeId: engine.draggedNodeId,
            },
            nodeList,
            debugStats,
            {
                degradeLevel,
                repulsionEnabled: feelRepulsionEnabled,
                collisionEnabled: feelCollisionEnabled,
                springsEnabled: feelSpringsEnabled,
                spacingEnabled: feelSpacingEnabled,
                triangleEnabled: feelTriangleEnabled,
                safetyEnabled: feelSafetyEnabled,
                microEnabled: !preRollActive && microEnabled,
            }
        );
    }
    engine.lastDebugStats = debugStats;

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
