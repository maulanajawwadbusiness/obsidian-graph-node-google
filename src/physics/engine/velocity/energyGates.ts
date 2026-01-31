export const isDense = (
    localDensity: number,
    densityThreshold: number = 4
): boolean => localDensity >= densityThreshold;
