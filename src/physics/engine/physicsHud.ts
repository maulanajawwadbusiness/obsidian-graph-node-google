export type PhysicsHudSnapshot = {
    degradeLevel: number;
    degradePct5s: number;
    settleState: 'moving' | 'cooling' | 'microkill' | 'sleep';
    lastSettleMs: number;
    jitterAvg: number;
    pbdCorrectionSum: number;
    conflictPct5s: number;
    energyProxy: number;
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
});

export const createInitialPhysicsHudHistory = (): PhysicsHudHistory => ({
    degradeFrames: [],
    conflictFrames: [],
    jitterSamples: [],
});
