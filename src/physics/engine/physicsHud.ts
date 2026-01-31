export type PhysicsHudSnapshot = {
    degradeLevel: number;
    degradePct5s: number;
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
    // PBD Disconnect Forensics
    maxPosDeltaConstraint?: number;
    maxVelDeltaConstraint?: number;
    maxPrevGap?: number;
    postCorrectEnergy?: number;
    postDiffuseEnergy?: number;
    // Injector Forensics
    microSlipCount?: number;
    microSlipFiresPerSec?: number;
    stuckScoreAvg?: number;
    driftCount?: number;
    escapeFiresPerSec?: number;
    escapeLoopSuspectCount?: number;
    lastInjector?: string;

    // Rest/Settle Forensics
    outlierCount?: number;
    settleBlockers?: string[];
    stateFlipCount?: number;
    calmPercent?: number;

    // Rest Truth Forensics
    restCandidates?: number;
    minSpeedSq?: number;
    p50SpeedSq?: number;
    breakdownSpeed?: number;
    breakdownForce?: number;
    breakdownPressure?: number;
    breakdownJitter?: number;
    // Settle Blockers (Why are we awake?)
    settleBlockers?: string[];
    outlierCount?: number;
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
    outlierCount: 0,
    stateFlipCount: 0,
    calmPercent: 0,
    settleBlockers: [],
});

export const createInitialPhysicsHudHistory = (): PhysicsHudHistory => ({
    degradeFrames: [],
    conflictFrames: [],
    jitterSamples: [],
});
