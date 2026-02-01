import type { PhysicsNode } from '../types';
import type { DebugStats } from './stats';
import type { PhysicsHudSnapshot } from './physicsHud';
import type { PhysicsEngineTickContext } from './engineTickTypes';

export const updateHudSnapshot = (
    engine: PhysicsEngineTickContext,
    nowMs: number,
    dtMs: number,
    nodes: PhysicsNode[],
    stats: DebugStats,
    spacingStride: number,
    settleStateOverride?: PhysicsHudSnapshot['settleState']
) => {
    const nodeCount = nodes.length || 1;
    let avgVelSq = 0;
    let maxPrevGap = 0;
    let ghostVelSuspectCount = 0;
    let firstConstraintDistPx = 0;
    let firstConstraintRestPx = 0;
    let firstConstraintErrPx = 0;
    let firstConstraintAId: string | undefined;
    let firstConstraintBId: string | undefined;
    let firstConstraintAX = 0;
    let firstConstraintAY = 0;
    let firstConstraintBX = 0;
    let firstConstraintBY = 0;
    let firstConstraintPrevDistPx = 0;
    let firstConstraintPrevAX = 0;
    let firstConstraintPrevAY = 0;
    let firstConstraintPrevBX = 0;
    let firstConstraintPrevBY = 0;

    for (const node of nodes) {
        avgVelSq += node.vx * node.vx + node.vy * node.vy;

        if (node.prevX !== undefined && node.prevY !== undefined) {
            const dx = node.x - node.prevX;
            const dy = node.y - node.prevY;
            const gap = Math.sqrt(dx * dx + dy * dy);
            if (gap > maxPrevGap) maxPrevGap = gap;

            const dtSec = dtMs / 1000;
            if (dtSec > 0.000001) {
                const vxImplied = dx / dtSec;
                const vyImplied = dy / dtSec;
                const vDiffX = vxImplied - node.vx;
                const vDiffY = vyImplied - node.vy;
                const mismatch = Math.sqrt(vDiffX * vDiffX + vDiffY * vDiffY);

                node.historyMismatch = mismatch;
                if (mismatch > 50.0) ghostVelSuspectCount++;
            }
        }
    }
    avgVelSq /= nodeCount;

    if (engine.xpbdConstraints && engine.xpbdConstraints.length > 0) {
        const c = engine.xpbdConstraints[0];
        const a = engine.nodes.get(c.nodeA);
        const b = engine.nodes.get(c.nodeB);
        if (a && b) {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            firstConstraintDistPx = dist;
            firstConstraintRestPx = c.restLen;
            firstConstraintErrPx = dist - c.restLen;
            firstConstraintAId = c.nodeA;
            firstConstraintBId = c.nodeB;
            firstConstraintAX = a.x;
            firstConstraintAY = a.y;
            firstConstraintBX = b.x;
            firstConstraintBY = b.y;

            const prev = engine.xpbdFirstPairPrev;
            if (prev && prev.aId === c.nodeA && prev.bId === c.nodeB) {
                const pdx = prev.bx - prev.ax;
                const pdy = prev.by - prev.ay;
                firstConstraintPrevDistPx = Math.sqrt(pdx * pdx + pdy * pdy);
                firstConstraintPrevAX = prev.ax;
                firstConstraintPrevAY = prev.ay;
                firstConstraintPrevBX = prev.bx;
                firstConstraintPrevBY = prev.by;
            }
        }
    }

    const corrections = stats.passes.Corrections?.correction ?? 0;
    const jitterSample = nodeCount > 0 ? corrections / nodeCount : 0;
    const conflictFrame = stats.correctionConflictCount > 0;

    stats.safety.correctionBudgetHits = 0;
    stats.safety.corrClippedTotal = 0;
    stats.safety.debtTotal = 0;
    stats.correctionConflictCount = 0;
    stats.corrSignFlipCount = 0;
    stats.restFlapCount = 0;

    stats.safety.minPairDist = 99999;
    stats.safety.nearOverlapCount = 0;
    stats.safety.repulsionMaxMag = 0;
    stats.safety.repulsionClampedCount = 0;

    stats.neighborReorderRate = stats.neighborReorderRate || 0;
    stats.hubFlipCount = stats.hubFlipCount || 0;
    stats.degradeFlipCount = stats.degradeFlipCount || 0;
    stats.lawPopScore = stats.lawPopScore || 0;
    stats.hubNodeCount = stats.hubNodeCount || 0;

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

    const T_Micro = 0.0004;
    const T_Cool = 0.04;
    const T_Move = 0.25;
    const H = 1.2;

    const current = engine.hudSettleState;
    let next = current;

    if (current === 'microkill') {
        if (avgVelSq > T_Micro * H) next = 'cooling';
        if (avgVelSq > T_Move) next = 'moving';
    } else if (current === 'cooling') {
        if (avgVelSq < T_Micro) next = 'microkill';
        if (avgVelSq > T_Cool * H) next = 'moving';
    } else if (current === 'moving') {
        if (avgVelSq < T_Cool) next = 'cooling';
    } else if (current === 'sleep') {
        if (avgVelSq > T_Micro) next = 'microkill';
    } else {
        next = 'moving';
    }

    if (settleStateOverride) next = settleStateOverride;

    if (next !== current) {
        engine.hudSettleState = next;
        engine.hudSettleStateAt = nowMs;

        if (nowMs - engine.hudSettleStateAt < 500) {
            stats.restFlapCount++;
        }
    }

    const settleState = engine.hudSettleState;

    engine.hudSnapshot = {
        degradeLevel: engine.degradeLevel,
        degradePct5s: degradeHits > 0 ? (degradeHits / degradeFrames) * 100 : 0,
        mode: stats.mode,
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

        // Spawn Forensic (First 2s)
        spawnTimestamp: stats.spawn.timestamp,
        spawnOverlapCount0: stats.spawn.overlapCount0,
        spawnOverlapCount100: stats.spawn.overlapCount100,
        spawnPeakOverlap30: stats.spawn.peakOverlapFirst2s30,
        spawnPeakOverlap100: stats.spawn.peakOverlapFirst2s100,
        spawnMaxSpeed: stats.spawn.maxSpeedFirst2s,
        spawnNaNCount: stats.spawn.nanCountFirst2s,
        spawnLeaks: stats.spawn.forbiddenPassLatched,
        spawnOrderHash: stats.spawn.spawnOrderHash,
        spawnSetHash: stats.spawn.spawnSetHash,
        orderHashChanged: stats.spawn.orderHashChanged,
        strictClampActive: stats.spawn.strictClampActive,
        strictClampTicksLeft: stats.spawn.strictClampTicksLeft,
        strictClampActionCount: stats.spawn.strictClampActionAppliedCount,
        microSlipDenied: stats.spawn.microSlipDeniedByStartup,
        escapeDenied: stats.spawn.escapeDeniedByStartup,

        dtSkewMaxMs: stats.dtSkew ? (stats.dtSkew.max - stats.dtSkew.min) * 1000 : 0,
        perDotUpdateCoveragePct: spacingStride > 1 ? (100 / spacingStride) : 100,
        coverageMode: spacingStride > 1 ? 'strided' : 'full',
        coverageStride: spacingStride,
        ageMaxFrames: spacingStride,
        ageP95Frames: spacingStride,

        maxPrevGap,
        maxPosDeltaConstraints: jitterSample,
        ghostVelSuspectCount,

        degenerateTriangleCount: stats.degenerateTriangleCount,
        correctionBudgetHits: stats.safety.correctionBudgetHits,
        corrClippedTotal: stats.safety.corrClippedTotal,
        debtTotal: stats.safety.debtTotal,
        orderMode: 'rotated',

        corrSignFlipRate: nodeCount > 0 ? (stats.corrSignFlipCount / nodeCount) * 100 : 0,
        restFlapRate: stats.restFlapCount,

        minPairDist: stats.safety.minPairDist === 99999 ? 0 : stats.safety.minPairDist,
        nearOverlapCount: stats.safety.nearOverlapCount,
        repulsionMaxMag: stats.safety.repulsionMaxMag,
        repulsionClampedCount: stats.safety.repulsionClampedCount,

        neighborReorderRate: stats.neighborReorderRate,
        hubFlipCount: stats.hubFlipCount,
        degradeFlipCount: stats.degradeFlipCount,
        lawPopScore: stats.lawPopScore,
        hubNodeCount: stats.hubNodeCount,

        microSlipCount: stats.injectors.microSlipCount,
        microSlipFiresPerSec: stats.injectors.microSlipFires * (1000 / dtMs),
        stuckScoreAvg: nodeCount > 0 ? (stats.injectors.stuckScoreSum / nodeCount) : 0,
        lastInjector: stats.injectors.lastInjector,
        driftCount: stats.injectors.driftCount,

        // Settle Forensics
        outlierCount: stats.outlierCount,
        calmPercent: stats.calmPercent,
        diffusionGate: stats.diffusionGate,

        diffusionStrengthNow: stats.diffusionStrengthNow,
        ghostMismatchCount: stats.ghostMismatchCount,
        diffusionPopScore: stats.diffusionPopScore,
        neighborDeltaRate: stats.neighborDeltaRate,
        determinismChecksum: stats.determinismChecksum,
        rebaseCount: stats.rebaseCount,
        maxAbsPos: stats.maxAbsPos,

        // XPBD Forensics
        xpbdCanaryActive: engine.config.debugXPBDCanary,
        constraintCorrectionAvg: nodeCount > 0 ? corrections / nodeCount : 0,
        constraintCorrectionMax: stats.passes.SpacingConstraints?.correctionMax || 0,
        repulsionEvents: stats.safety.repulsionClampedCount, // Proxy for now, or add real count in forces

        // XPBD Proof-of-Life
        xpbdSpringCounts: {
            count: stats.xpbd.springConstraintsCount,
            iter: stats.xpbd.springIterations
        },
        xpbdSpringCorr: {
            avg: stats.xpbd.springCorrAvgPx,
            max: stats.xpbd.springCorrMaxPx
        },
        xpbdSpringError: {
            avg: stats.xpbd.springErrorAvgPx,
            max: stats.xpbd.springErrorMaxPx
        },
        xpbdRepelCounts: {
            checked: stats.xpbd.repelPairsChecked,
            solved: stats.xpbd.repelPairsSolved,
            overlap: stats.xpbd.overlapCount
        },
        xpbdRepelCorr: {
            avg: stats.xpbd.repelCorrAvgPx,
            max: stats.xpbd.repelCorrMaxPx
        },
        xpbdRepelSingularities: stats.xpbd.repelSingularityFallbackCount,
        xpbdEdgeConstraintCount: engine.xpbdFrameAccum?.edgeConstraintsExecuted ?? 0,

        // XPBD Springs Proof-of-Life 0
        xpbdSpringEnabled: !!engine.config.useXPBD,
        xpbdSpringConstraints: engine.xpbdFrameAccum?.springs.count ?? 0,
        xpbdSpringSolved: engine.xpbdFrameAccum?.springs.iter ?? 0,
        xpbdSpringCorrMaxPx: engine.xpbdFrameAccum?.springs.corrMax ?? 0,
        xpbdSpringErrAvgPx: (engine.xpbdFrameAccum?.springs.count || 0) > 0
            ? (engine.xpbdFrameAccum!.springs.errSum / engine.xpbdFrameAccum!.springs.count)
            : 0,
        xpbdSpringSolveMs: engine.xpbdFrameAccum?.springs.solveMs ?? 0,

        xpbdSpringRestMinPx: engine.xpbdConstraintStats?.minRest ?? 0,
        xpbdSpringRestMaxPx: engine.xpbdConstraintStats?.maxRest ?? 0,
        xpbdSpringRestAvgPx: engine.xpbdConstraintStats?.avgRest ?? 0,

        // Run 2: Iterations
        xpbdIterationsIdle: engine.config.xpbdIterationsIdle ?? 2,
        xpbdIterationsDrag: engine.config.xpbdIterationsDrag ?? 6,
        xpbdIterationsUsed: engine.xpbdFrameAccum?.springs.iter ?? 1,
        xpbdEarlyBreaks: engine.xpbdFrameAccum?.springs.earlyBreakCount ?? 0,
        xpbdMaxAbsC: engine.xpbdFrameAccum?.springs.maxAbsC ?? 0,

        // Mini Run 4: Validation
        xpbdSpringSkipped: engine.xpbdFrameAccum?.springs.skipped ?? 0,
        xpbdSpringSingularity: engine.xpbdFrameAccum?.springs.singularity ?? 0,
        xpbdSpringPrevAdjusted: engine.xpbdFrameAccum?.springs.prevAdjusted ?? 0,
        xpbdGhostVelMax: engine.xpbdFrameAccum?.springs.ghostVelMax ?? 0,
        xpbdGhostVelEvents: engine.xpbdFrameAccum?.springs.ghostVelEvents ?? 0,
        releaseGhostEvents: engine.xpbdFrameAccum?.springs.releaseGhostEvents ?? 0,
        xpbdGhostSyncs: engine.xpbdFrameAccum?.springs.prevAdjusted ?? 0,

        xpbdInvNonFinite: engine.xpbdConstraintStats?.nonFiniteRestLenCount ?? 0,
        xpbdInvZero: engine.xpbdConstraintStats?.zeroLenEdgeCount ?? 0,

        // Mini Run 7: Drag Coupling
        dragActive: !!engine.draggedNodeId,
        draggedNodeId: engine.draggedNodeId,
        dragInvMassMode: true, // Kinematic lock is effective infinite mass
        dragLagMax: engine.xpbdFrameAccum?.springs.dragLagMax ?? 0,

        // Run 1: Propagation Proof Placeholders -> Run 2: Wired
        propEdgesSolved: engine.xpbdFrameAccum?.springs.edgesProcessed ?? 0,
        propTotalEdges: engine.xpbdFrameAccum?.springs.totalEdgesGraph ?? 0,
        propNodesUpdated: spacingStride > 1 ? Math.ceil(nodeCount / spacingStride) : nodeCount,
        propTotalNodes: nodeCount,
        propMaxAbsC: engine.xpbdFrameAccum?.springs.maxAbsC ?? 0,
        propMovedNodes: 0,
        propMovedHop1: 0,
        propMovedHop2: 0,
        propMovedHop3Plus: 0,

        xpbdFirstConstraintDistPx: firstConstraintDistPx,
        xpbdFirstConstraintRestPx: firstConstraintRestPx,
        xpbdFirstConstraintErrPx: firstConstraintErrPx,
        xpbdFirstConstraintAId: firstConstraintAId,
        xpbdFirstConstraintBId: firstConstraintBId,
        xpbdFirstConstraintAX: firstConstraintAX,
        xpbdFirstConstraintAY: firstConstraintAY,
        xpbdFirstConstraintBX: firstConstraintBX,
        xpbdFirstConstraintBY: firstConstraintBY,
        xpbdFirstConstraintPrevDistPx: firstConstraintPrevDistPx,
        xpbdFirstConstraintPrevAX: firstConstraintPrevAX,
        xpbdFirstConstraintPrevAY: firstConstraintPrevAY,
        xpbdFirstConstraintPrevBX: firstConstraintPrevBX,
        xpbdFirstConstraintPrevBY: firstConstraintPrevBY,
        xpbdFirstJumpPx: engine.xpbdFrameAccum?.springs.firstJumpPx ?? 0,
        xpbdFirstJumpPhase: engine.xpbdFrameAccum?.springs.firstJumpPhase ?? 'none',
        xpbdFirstJumpNodeId: engine.xpbdFrameAccum?.springs.firstJumpNodeId ?? null,
        xpbdFirstPreIntegrateJumpPx: engine.xpbdFrameAccum?.springs.firstPreIntegrateJumpPx ?? 0,
        xpbdFirstPreIntegrateNodeId: engine.xpbdFrameAccum?.springs.firstPreIntegrateNodeId ?? null,
        xpbdFirstMovePx: engine.xpbdFrameAccum?.springs.firstMovePx ?? 0,
        xpbdFirstMovePhase: engine.xpbdFrameAccum?.springs.firstMovePhase ?? 'none',
        xpbdFirstMoveNodeId: engine.xpbdFrameAccum?.springs.firstMoveNodeId ?? null,
        xpbdFirstCapHit: engine.xpbdFrameAccum?.springs.firstCapHit ?? false,
        xpbdFirstAlpha: engine.xpbdFrameAccum?.springs.firstAlpha ?? 0,
        xpbdFirstWSum: engine.xpbdFrameAccum?.springs.firstWSum ?? 0,
        xpbdFirstEdgeDebug: engine.xpbdFrameAccum?.springs.firstEdgeDebug ?? undefined,

        dragLeashEnabled: false, // Run 7.6: Audit confirmed false
        dragLeashRadius: 0,

        // Run 1: Edge Coverage
        totalEdgesGraph: engine.xpbdFrameAccum?.springs.totalEdgesGraph ?? 0,
        edgesSelectedForSolve: engine.xpbdFrameAccum?.springs.edgesSelectedForSolve ?? 0,
        edgesSelectedReason: engine.xpbdFrameAccum?.springs.edgesSelectedReason ?? '-',
        edgesSkippedByCoverage: engine.xpbdFrameAccum?.springs.edgesSkippedByCoverage ?? 0,
        edgesProcessed: engine.xpbdFrameAccum?.springs.edgesProcessed ?? 0,
        edgesSelectedButUnprocessed: engine.xpbdFrameAccum?.springs.edgesSelectedButUnprocessed ?? 0,

        // Frame Accumulators
        ticksThisFrame: engine.xpbdFrameAccum?.ticks || 0,
        dtUseSecLastTick: dtMs / 1000,
        dtUseSecFrameAvg: (engine.xpbdFrameAccum?.ticks > 0)
            ? (engine.xpbdFrameAccum.dtSum / engine.xpbdFrameAccum.ticks)
            : (dtMs / 1000),

        escapeFiresPerSec: stats.injectors.escapeFires,
        escapeLoopSuspectCount: stats.injectors.escapeLoopSuspectCount,

    };
};
