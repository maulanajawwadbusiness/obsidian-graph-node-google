export type CadenceConfig = {
    baseCharMs: number;
    spaceMs: number;
    commaPauseMs: number;
    periodPauseMs: number;
    questionPauseMs: number;
    newlinePauseMs: number;
    paragraphPauseMs: number;
    markerPauseDefaultMs: number;
    endHoldMs: number;
    speedMultiplier: number;
};

export type CadencePresetName = 'fast' | 'normal' | 'slow';

export const CADENCE_PRESETS: Record<CadencePresetName, CadenceConfig> = {
    fast: {
        baseCharMs: 24,
        spaceMs: 0,
        commaPauseMs: 55,
        periodPauseMs: 120,
        questionPauseMs: 140,
        newlinePauseMs: 90,
        paragraphPauseMs: 210,
        markerPauseDefaultMs: 180,
        endHoldMs: 300,
        speedMultiplier: 0.9,
    },
    normal: {
        baseCharMs: 26,
        spaceMs: 0,
        commaPauseMs: 65,
        periodPauseMs: 140,
        questionPauseMs: 165,
        newlinePauseMs: 110,
        paragraphPauseMs: 260,
        markerPauseDefaultMs: 220,
        endHoldMs: 420,
        speedMultiplier: 1.0,
    },
    slow: {
        baseCharMs: 30,
        spaceMs: 0,
        commaPauseMs: 80,
        periodPauseMs: 175,
        questionPauseMs: 210,
        newlinePauseMs: 130,
        paragraphPauseMs: 320,
        markerPauseDefaultMs: 260,
        endHoldMs: 520,
        speedMultiplier: 1.15,
    },
};

export const DEFAULT_CADENCE: CadenceConfig = CADENCE_PRESETS.normal;

function clampMultiplier(multiplier: number): number {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        return 1.0;
    }
    return multiplier;
}

function scaleMs(ms: number, multiplier: number): number {
    return Math.max(0, Math.round(ms * multiplier));
}

export function applySpeed(cfg: CadenceConfig, multiplier: number): CadenceConfig {
    const resolvedMultiplier = clampMultiplier(cfg.speedMultiplier * multiplier);
    return {
        ...cfg,
        baseCharMs: scaleMs(cfg.baseCharMs, resolvedMultiplier),
        spaceMs: scaleMs(cfg.spaceMs, resolvedMultiplier),
        commaPauseMs: scaleMs(cfg.commaPauseMs, resolvedMultiplier),
        periodPauseMs: scaleMs(cfg.periodPauseMs, resolvedMultiplier),
        questionPauseMs: scaleMs(cfg.questionPauseMs, resolvedMultiplier),
        newlinePauseMs: scaleMs(cfg.newlinePauseMs, resolvedMultiplier),
        paragraphPauseMs: scaleMs(cfg.paragraphPauseMs, resolvedMultiplier),
        markerPauseDefaultMs: scaleMs(cfg.markerPauseDefaultMs, resolvedMultiplier),
        endHoldMs: scaleMs(cfg.endHoldMs, resolvedMultiplier),
        speedMultiplier: resolvedMultiplier,
    };
}
