export type PhysicsHudSnapshot = {
    degradeLevel: number;
    degradePct5s: number;
    mode?: 'LEGACY' | 'XPBD';
    settleState: 'moving' | 'cooling' | 'microkill' | 'sleep';
    lastSettleMs: number;
    jitterAvg: number;
    pbdCorrectionSum: number;
    conflictPct5s: number;
    energyProxy: number;
    // Startup Audit
    startupNanCount?: number;
    startupInfCount?: number;
    startupMaxSpeed?: number;
    startupDtClamps?: number;

    // Spawn Forensic (First 2s)
    spawnTimestamp?: number;
    spawnOverlapCount0?: number;
    spawnOverlapCount100?: number;
    spawnPeakOverlap?: number;
    spawnMaxSpeed?: number;
    spawnNaNCount?: number;
    spawnLeaks?: boolean;
    spawnOrderHash?: number;
    spawnSetHash?: number;
    orderHashChanged?: boolean;
    strictClampActive?: boolean;
    strictClampTicksLeft?: number;
    strictClampActionCount?: number;
    spawnPeakOverlap30?: number;
    spawnPeakOverlap100?: number;
    microSlipDenied?: number;
    escapeDenied?: number;
    // PBD Disconnect Forensics
    maxPosDeltaConstraint?: number;
    maxVelDeltaConstraint?: number;
    maxPrevGap?: number;
    postCorrectEnergy?: number;
    postDiffuseEnergy?: number;
    // Injector Forensics
    microSlipCount?: number;
    microSlipFiresPerSec?: number;
    stuckScoreAvg?: number; // Re-adding if needed or removing from init
    driftCount: number;

    // Settle Forensics
    outlierCount: number;
    calmPercent: number;
    diffusionGate: number;
    diffusionStrengthNow: number;
    ghostMismatchCount: number;
    diffusionPopScore: number;
    neighborDeltaRate: number;
    determinismChecksum: string;
    rebaseCount: number;
    maxAbsPos: number;

    // XPBD Forensics
    xpbdCanaryActive?: boolean;
    constraintCorrectionAvg?: number; // Average correction per node
    constraintCorrectionMax?: number; // Peak correction this frame
    repulsionEvents?: number;         // Number of repulsion triggers

    // XPBD Proof-of-Life
    xpbdSpringCounts?: { count: number; iter: number };
    xpbdSpringCorr?: { avg: number; max: number };
    xpbdSpringError?: { avg: number; max: number };
    xpbdRepelCounts?: { checked: number; solved: number; overlap: number };
    xpbdRepelCorr?: { avg: number; max: number };
    xpbdRepelSingularities?: number;
    xpbdEdgeConstraintCount?: number;

    // XPBD Springs Proof-of-Life 0
    xpbdSpringEnabled?: boolean;
    xpbdSpringConstraints?: number;
    xpbdSpringSolved?: number;
    xpbdSpringCorrMaxPx?: number;
    xpbdSpringErrAvgPx?: number;
    xpbdSpringSolveMs?: number;

    xpbdSpringRestMinPx?: number;
    xpbdSpringRestMaxPx?: number;
    xpbdSpringRestAvgPx?: number;

    // XPBD Iteration Budget (Run 1)
    xpbdIterationsIdle?: number;
    xpbdIterationsDrag?: number;
    xpbdIterationsUsed?: number;
    xpbdEarlyBreaks?: number;
    xpbdMaxAbsC?: number;

    // Mini Run 6: Calibration Telemetry
    xpbdComplianceUsed?: number;  // Actual compliance value in use
    xpbdAlphaAvg?: number;  // Average alpha (compliance/dt²) for verification

    // Mini Run 7: Drag Coupling
    xpbdDragActive?: boolean;
    xpbdDragKinematic?: boolean;
    xpbdDragSyncs?: number;

    // Mini Run 4: Validation & Safety
    xpbdSpringSkipped?: number;
    xpbdSpringSingularity?: number;
    xpbdSpringPrevAdjusted?: number;
    xpbdInvInvalid?: number;
    xpbdInvNonFinite?: number;
    xpbdInvZero?: number;

    // Mini Run 5: Ghost Velocity Reconcile
    xpbdGhostVelMax?: number;
    xpbdGhostVelEvents?: number;
    xpbdGhostSyncs?: number;
    releaseGhostEvents?: number;

    // Mini Run 7: Drag Coupling
    dragActive?: boolean;
    draggedNodeId?: string | null;
    dragInvMassMode?: boolean;
    dragLagMax?: number;

    // XPBD Debug: First Constraint Snapshot
    xpbdFirstConstraintDistPx?: number;
    xpbdFirstConstraintRestPx?: number;
    xpbdFirstConstraintErrPx?: number;
    xpbdFirstConstraintAId?: string;
    xpbdFirstConstraintBId?: string;
    xpbdFirstConstraintAX?: number;
    xpbdFirstConstraintAY?: number;
    xpbdFirstConstraintBX?: number;
    xpbdFirstConstraintBY?: number;
    xpbdFirstConstraintPrevDistPx?: number;
    xpbdFirstConstraintPrevAX?: number;
    xpbdFirstConstraintPrevAY?: number;
    xpbdFirstConstraintPrevBX?: number;
    xpbdFirstConstraintPrevBY?: number;
    xpbdFirstJumpPx?: number;
    xpbdFirstJumpPhase?: 'integrate' | 'solver' | 'none';
    xpbdFirstJumpNodeId?: string | null;
    xpbdFirstPreIntegrateJumpPx?: number;
    xpbdFirstPreIntegrateNodeId?: string | null;
    xpbdFirstMovePx?: number;
    xpbdFirstMovePhase?: 'pre' | 'integrate' | 'solver' | 'none';
    xpbdFirstMoveNodeId?: string | null;
    xpbdFirstCapHit?: boolean;
    xpbdFirstAlpha?: number;
    xpbdFirstWSum?: number;

    // Run 1: Repulsion Proof Placeholders
    repulsionProofEnteredFrame?: number;
    repulsionProofCalledThisFrame?: boolean;
    repulsionProofPairsChecked?: number;
    repulsionProofPairsApplied?: number;
    repulsionProofMaxForce?: number;
    repulsionAwakeCount?: number;
    repulsionSleepingCount?: number;
    repulsionPairStride?: number;
    repulsionProofEnabled?: boolean;

    // Mini Run 3 (A3): LastFrame Snapshots (prevent flickering)
    repulsionCalledLastFrame?: boolean;
    repulsionPairsCheckedLastFrame?: number;
    repulsionPairsAppliedLastFrame?: number;
    repulsionMaxForceMagLastFrame?: number;

    // Lane A: Sign & Gradient Debug
    xpbdFirstEdgeDebug?: {
        C: number;
        deltaLambda: number;
        corrDotA: number;
        corrDotB: number;
        gradX: number;
        gradY: number;
    };

    // Run 7.6: Leash Telemetry
    dragLeashEnabled?: boolean;
    dragLeashRadius?: number;

    // Run 1: Edge Coverage Telemetry
    totalEdgesGraph?: number;
    edgesSelectedForSolve?: number;
    edgesSelectedReason?: string;
    edgesSkippedByCoverage?: number;
    edgesProcessed?: number;
    edgesSelectedButUnprocessed?: number;

    // Run 1: Propagation Proof Placeholders
    propEdgesSolved?: number;
    propTotalEdges?: number;
    propNodesUpdated?: number;
    propTotalNodes?: number;
    propMaxAbsC?: number;
    propMaxAbsCFirst?: number; // Run 3: Convergence
    propMovedNodes?: number;
    propMovedHop1?: number;
    propMovedHop2?: number;
    propMovedHop3Plus?: number;

    // Frame Accumulators
    ticksThisFrame?: number;
    dtUseSecLastTick?: number;
    dtUseSecFrameAvg?: number;

    escapeFiresPerSec?: number;
    escapeLoopSuspectCount?: number;
    lastInjector?: string;

    // Legacy / Unused
    settleBlockers?: string[];
    stateFlipCount?: number;

    // Rest Truth Forensics
    restCandidates?: number;
    minSpeedSq?: number;
    p50SpeedSq?: number;
    breakdownSpeed?: number;
    breakdownForce?: number;
    breakdownPressure?: number;
    breakdownJitter?: number;

    // DT Forensics
    dtRawMs?: number;
    dtUseMs?: number;
    dtSpikeCount?: number;
    quarantineStrength?: number;
    // Fix: DT Consistency & Coverage Diagnostics
    dtSkewMaxMs?: number;
    perDotUpdateCoveragePct?: number;
    coverageMode?: 'full' | 'strided' | 'clustered';
    coverageStride?: number;
    ageMaxFrames?: number;
    ageP95Frames?: number;

    // Singularity Stats
    minPairDist?: number;
    nearOverlapCount?: number;
    repulsionMaxMag?: number;
    repulsionClampedCount?: number;

    // Repulsion Execution Telemetry (Truth Scan)
    repulsionCalledThisFrame?: boolean;
    repulsionPairsChecked?: number;
    repulsionPairsApplied?: number;
    repulsionForceMagMax?: number;

    // XPBD Repulsion Telemetry (Run 3 - Mini Run 2)
    xpbdRepulsionEnabled?: boolean;
    xpbdRepulsionCalledThisFrame?: boolean;
    xpbdRepulsionPairsChecked?: number;
    xpbdRepulsionMaxForce?: number;
    xpbdRepulsionNodesAffected?: number;

    // Repulsion Config Live Telemetry (Run 3 - Mini Run 4)
    repulsionStrengthConfig?: number;
    repulsionDistanceMaxConfig?: number;
    repulsionMinDistanceConfig?: number;
    repulsionMaxForceConfig?: number;

    // Forensic: Stability
    neighborReorderRate?: number;
    hubFlipCount?: number;
    degradeFlipCount?: number;
    lawPopScore?: number;
    hubNodeCount?: number;

    // Ghost Velocity Forensics
    // maxPrevGap?: number; // Removed duplicate
    maxPosDeltaConstraints?: number;
    ghostVelSuspectCount?: number;
    ghostVelEfficiency?: number; // Ratio of cleanup // Keep this one
    // ghostVelEfficiency?: number; // Ratio of cleanup // Removed duplicate

    // Degeneracy & Solver Health
    degenerateTriangleCount?: number;
    correctionBudgetHits?: number;
    corrClippedTotal?: number;
    debtTotal?: number;
    orderMode?: string;

    // Oscillation
    corrSignFlipRate?: number; // % of active nodes flipping sign
    restFlapRate?: number; // Flaps per second
};

export type PhysicsHudHistory = {
    degradeFrames: { t: number; degraded: boolean }[];
    conflictFrames: { t: number; conflict: boolean }[];
    jitterSamples: { t: number; value: number }[];
};

export const createInitialPhysicsHudSnapshot = (): PhysicsHudSnapshot => ({
    degradeLevel: 0,
    degradePct5s: 0,
    settleState: 'moving',
    lastSettleMs: 0,
    jitterAvg: 0,
    pbdCorrectionSum: 0,
    conflictPct5s: 0,
    energyProxy: 0,
    microSlipFiresPerSec: 0,
    stuckScoreAvg: 0,
    escapeFiresPerSec: 0,
    escapeLoopSuspectCount: 0,
    diffusionStrengthNow: 0,
    ghostMismatchCount: 0,
    diffusionPopScore: 0,
    neighborDeltaRate: 0,
    determinismChecksum: '0000',
    rebaseCount: 0,
    maxAbsPos: 0,

    outlierCount: 0,
    stateFlipCount: 0,
    driftCount: 0,
    calmPercent: 0,
    diffusionGate: 0,
    settleBlockers: [],

    // Init XPBD items
    xpbdSpringEnabled: false,
    xpbdSpringConstraints: 0,
    xpbdSpringSolved: 0,
    xpbdSpringCorrMaxPx: 0.0,
    xpbdSpringErrAvgPx: 0.0,
    xpbdSpringSolveMs: 0.0,
});

export const createInitialPhysicsHudHistory = (): PhysicsHudHistory => ({
    degradeFrames: [],
    conflictFrames: [],
    jitterSamples: [],
});
