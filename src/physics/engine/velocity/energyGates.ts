export const isEarlyExpansion = (energy: number): boolean => energy > 0.85;

export const isDense = (
    localDensity: number,
    densityThreshold: number = 4
): boolean => localDensity >= densityThreshold;
