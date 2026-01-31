export type PassStats = {
    force: number;
    velocity: number;
    correction: number;
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

};

export const createDebugStats = (): DebugStats => ({
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
