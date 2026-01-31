import { smoothstep } from '../unifiedMotionState';

export const getEarlyExpansionRamp = (temperature: number): number => (
    smoothstep(0.7, 0.9, temperature)
);

export const getDenseRamp = (
    localDensity: number,
    densityThreshold: number = 4
): number => smoothstep(densityThreshold - 1, densityThreshold + 1, localDensity);
