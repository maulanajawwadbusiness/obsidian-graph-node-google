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

function scaleCadence(
    cfg: CadenceConfig,
    factor: number
): CadenceConfig {
    return {
        baseCharMs: Math.max(0, Math.round(cfg.baseCharMs * factor)),
        spaceMs: Math.max(0, Math.round(cfg.spaceMs * factor)),
        commaPauseMs: Math.max(0, Math.round(cfg.commaPauseMs * factor)),
        periodPauseMs: Math.max(0, Math.round(cfg.periodPauseMs * factor)),
        questionPauseMs: Math.max(0, Math.round(cfg.questionPauseMs * factor)),
        newlinePauseMs: Math.max(0, Math.round(cfg.newlinePauseMs * factor)),
        paragraphPauseMs: Math.max(0, Math.round(cfg.paragraphPauseMs * factor)),
        markerPauseDefaultMs: Math.max(0, Math.round(cfg.markerPauseDefaultMs * factor)),
        endHoldMs: Math.max(0, Math.round(cfg.endHoldMs * factor)),
        speedMultiplier: 1.0,
    };
}

const NORMAL_CADENCE: CadenceConfig = {
    baseCharMs: 42,
    spaceMs: 14,
    commaPauseMs: 220,
    periodPauseMs: 480,
    questionPauseMs: 520,
    newlinePauseMs: 420,
    paragraphPauseMs: 1000,
    markerPauseDefaultMs: 450,
    endHoldMs: 900,
    speedMultiplier: 1.0,
};

export const CADENCE_PRESETS: Record<CadencePresetName, CadenceConfig> = {
    fast: scaleCadence(NORMAL_CADENCE, 0.85),
    normal: NORMAL_CADENCE,
    slow: scaleCadence(NORMAL_CADENCE, 1.25),
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
