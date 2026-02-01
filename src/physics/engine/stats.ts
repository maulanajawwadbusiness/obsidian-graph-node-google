export type PassStats = {
    force: number;
    velocity: number;
    correction: number;
    correctionMax?: number; // New: Peak correction magnitude
    nodes: number;
};

export type SafetyStats = {
    clampTriggers: number;
    penetrationTotal: number;
    penetrationCount: number;
    correctionBudgetHits: number;
    corrClippedTotal: number;
    debtTotal: number;
    // Singularity Forensics
    minPairDist: number;
    nearOverlapCount: number;
    repulsionMaxMag: number;
    repulsionClampedCount: number;
};

export type ExpansionResistanceStats = {
    trappedHubCount: number;
    skippedHubCount: number;
    avgHubSpeedBefore: number;
    avgHubSpeedAfter: number;
};

export type DebugStats = {
    mode: 'LEGACY' | 'XPBD';
    forbiddenPassCount: number;
    forbiddenLeakLatched: boolean;
    forbiddenPassLast?: string;
    passes: Record<string, PassStats>;
    safety: SafetyStats;
    expansionResistance: ExpansionResistanceStats;
    dtSkew?: { min: number; max: number };
    correctionConflictCount: number;
    corrSignFlipCount: number; // New: Oscillation Metric
    restFlapCount: number;     // New: Stability Metric
    degenerateTriangleCount: number; // New metric
    // New: Micro-Jitter Forensics
    energyLedger: { stage: string; energy: number; delta: number }[];
    fightLedger: { stage: string; conflictPct: number; avgCorr: number }[];
    canaryTrace: { stage: string; hash: number }[]; // Canary for Write Ownership
    injectors: {
        microSlipCount: number;
        microSlipDv: number;
        microSlipFires: number; // Count of individual firings (per dot)
        stuckScoreSum: number;  // Sum of stuck scores for average
        driftCount: number;
        driftDv: number;
        unstuckCount: number;
        lastInjector: string;

        // Escape Forensics
        escapeFires: number;
        escapeLoopSuspectCount: number; // Count of fires opposing constraint
    };
    neighborReorderRate: number; // Forensic: Stability Metric
    // Law Pop Diagnostics
    hubFlipCount: number;
    degradeFlipCount: number;
    lawPopScore: number;
    hubNodeCount: number;

    // FORENSIC: Spawn/Startup Hygiene (First 2s)
    spawn: {
        timestamp: number;
        overlapCount0: number; // At t=0 (R=30)
        overlapCount100: number; // At t=0 (R=100 or minDist)
        peakOverlapFirst2s: number;
        maxSpeedFirst2s: number;
        nanCountFirst2s: number;
        ticksSinceSpawn: number;
        forbiddenPassLatched: boolean; // Leaks in first 2s
        spawnOrderHash: number;
        strictClampActive: boolean;
        strictClampTicksLeft: number;
    };

    // Settle Diagnostics
    outlierCount: number;
    calmPercent: number;
    diffusionGate: number;

    // Diffusion Forensics
    // Diffusion Forensics
    diffusionStrengthNow: number;
    diffusionDeltaP95: number;
    ghostMismatchCount: number;

    // Diffusion Stability
    diffusionPopScore: number;
    neighborDeltaRate: number;

    // Determinism & Rebase
    determinismChecksum: string;
    rebaseCount: number;
    maxAbsPos: number;

    // XPBD Forensics
    xpbd: {
        springConstraintsCount: number;
        springCorrAvgPx: number;
        springCorrMaxPx: number;
        springErrorAvgPx: number;
        springErrorMaxPx: number;
        springIterations: number;

        repelPairsChecked: number;
        repelPairsSolved: number;
        overlapCount: number;
        repelCorrAvgPx: number;
        repelCorrMaxPx: number;
        repelSingularityFallbackCount: number;
    };
    canaryShiftApplied?: boolean;
};

export const createDebugStats = (): DebugStats => ({
    mode: 'LEGACY',
    forbiddenPassCount: 0,
    forbiddenLeakLatched: false,
    passes: {},
    safety: {
        clampTriggers: 0,
        penetrationTotal: 0,
        penetrationCount: 0,
        correctionBudgetHits: 0,
        corrClippedTotal: 0,
        debtTotal: 0,
        minPairDist: 99999, // Init high
        nearOverlapCount: 0,
        repulsionMaxMag: 0,
        repulsionClampedCount: 0,
    },
    expansionResistance: {
        trappedHubCount: 0,
        skippedHubCount: 0,
        avgHubSpeedBefore: 0,
        avgHubSpeedAfter: 0,
    },
    correctionConflictCount: 0,
    corrSignFlipCount: 0,
    restFlapCount: 0,
    degenerateTriangleCount: 0,
    energyLedger: [],
    fightLedger: [],
    canaryTrace: [],
    injectors: {
        microSlipCount: 0,
        microSlipDv: 0,
        microSlipFires: 0,
        stuckScoreSum: 0,
        driftCount: 0,
        driftDv: 0,
        unstuckCount: 0,
        lastInjector: '',

        escapeFires: 0,
        escapeLoopSuspectCount: 0,
    },
    neighborReorderRate: 0,
    hubFlipCount: 0,
    degradeFlipCount: 0,
    lawPopScore: 0,
    hubNodeCount: 0,
    spawn: {
        timestamp: 0,
        overlapCount0: 0,
        overlapCount100: 0,
        peakOverlapFirst2s: 0,
        maxSpeedFirst2s: 0,
        nanCountFirst2s: 0,
        ticksSinceSpawn: 0,
        forbiddenPassLatched: false,
        spawnOrderHash: 0,
        strictClampActive: false,
        strictClampTicksLeft: 0,
    },

    outlierCount: 0,
    calmPercent: 0,
    diffusionGate: 0,

    diffusionStrengthNow: 0,
    diffusionDeltaP95: 0,
    ghostMismatchCount: 0,

    diffusionPopScore: 0,
    neighborDeltaRate: 0,

    determinismChecksum: '0000',
    rebaseCount: 0,
    maxAbsPos: 0,

    xpbd: {
        springConstraintsCount: 0,
        springCorrAvgPx: 0,
        springCorrMaxPx: 0,
        springErrorAvgPx: 0,
        springErrorMaxPx: 0,
        springIterations: 0,
        repelPairsChecked: 0,
        repelPairsSolved: 0,
        overlapCount: 0,
        repelCorrAvgPx: 0,
        repelCorrMaxPx: 0,
        repelSingularityFallbackCount: 0,
    },
});

export const getPassStats = (stats: DebugStats, name: string): PassStats => {
    if (!stats.passes[name]) {
        stats.passes[name] = {
            force: 0,
            velocity: 0,
            correction: 0,
            nodes: 0,
        };
    }
    return stats.passes[name];
};
