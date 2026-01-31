import type { ForceConfig } from '../types';
import type { UnifiedMotionState } from './unifiedMotionState';

export type MotionPolicy = {
    distanceEpsilon: number;
    densityRadius: number;
    densityThreshold: number;
    speedEpsilon: number;
    stuckSpeedEpsilon: number;
    stuckForceEpsilon: number;
    restLengthEpsilon: number;
    driftMagnitude: number;
    microSlip: number;
    decoherenceAngle: { min: number; max: number };
    settle: {
        movingTemp: number;
        movingSpeed: number;
        movingCorrection: number;
        coolingTemp: number;
        coolingSpeed: number;
        coolingCorrection: number;
        microSpeed: number;
        microCorrection: number;
        sleepSpeed: number;
        sleepCorrection: number;
        sleepJitter: number;
        microKillStrength: number;
    };
    interaction: {
        localBoostFrames: number;
        localBoostStrength: number;
        localBoostRadius: number;
        releaseDamping: number;
        maxReleaseSpeed: number;
    };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// MotionPolicy is the single-law authority for movement behavior.
export const computeMotionPolicy = (
    motionState: UnifiedMotionState,
    config: ForceConfig,
    maxVelocityEffective: number
): MotionPolicy => {
    const minDistance = Math.max(1, config.minNodeDistance);
    const distanceEpsilon = Math.max(0.001, minDistance * 0.001);
    const densityRadius = minDistance * 0.3;
    const densityThreshold = Math.max(2, Math.round(minDistance / 25));
    const speedEpsilon = Math.max(0.08, config.maxVelocity * 0.0015);
    const stuckSpeedEpsilon = Math.max(0.3, config.maxVelocity * 0.006);
    const stuckForceEpsilon = Math.max(0.2, config.springStiffness * config.targetSpacing * 0.005);
    const restLengthEpsilon = minDistance * 0.05;
    const driftMagnitude = minDistance * 0.0002;
    const microSlip = minDistance * 0.0003;

    const angleScale = 0.7 + 0.6 * motionState.density;
    const minAngle = (0.5 * Math.PI / 180) * angleScale;
    const maxAngle = (1.5 * Math.PI / 180) * angleScale;

    const microKillStrength = 0.1 + 0.2 * clamp01(1 - motionState.temperature);

    const authorityFactor = motionState.authority === 'dragged' ? 1 : 0.6;
    const densityFactor = 0.6 + 0.4 * motionState.density;

    return {
        distanceEpsilon,
        densityRadius,
        densityThreshold,
        speedEpsilon,
        stuckSpeedEpsilon,
        stuckForceEpsilon,
        restLengthEpsilon,
        driftMagnitude,
        microSlip,
        decoherenceAngle: { min: minAngle, max: maxAngle },
        settle: {
            movingTemp: 0.35,
            movingSpeed: 0.02,
            movingCorrection: 0.02,
            coolingTemp: 0.2,
            coolingSpeed: 0.012,
            coolingCorrection: 0.012,
            microSpeed: 0.005,
            microCorrection: 0.006,
            sleepSpeed: 0.004,
            sleepCorrection: 0.004,
            sleepJitter: 0.002,
            microKillStrength,
        },
        interaction: {
            localBoostFrames: Math.max(4, Math.round(4 + 10 * motionState.density)),
            localBoostStrength: authorityFactor * densityFactor,
            localBoostRadius: Math.max(1, config.targetSpacing) * (1 + 0.35 * motionState.density),
            releaseDamping: 0.55 + 0.35 * motionState.density,
            maxReleaseSpeed: Math.min(config.maxVelocity * 0.8, maxVelocityEffective),
        },
    };
};
