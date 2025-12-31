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
};

export type DebugStats = {
    passes: Record<string, PassStats>;
    safety: SafetyStats;
};

export const createDebugStats = (): DebugStats => ({
    passes: {},
    safety: {
        clampTriggers: 0,
        penetrationTotal: 0,
        penetrationCount: 0,
        correctionBudgetHits: 0,
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
