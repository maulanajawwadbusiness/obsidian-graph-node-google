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
});

export const createInitialPhysicsHudHistory = (): PhysicsHudHistory => ({
    degradeFrames: [],
    conflictFrames: [],
    jitterSamples: [],
});
