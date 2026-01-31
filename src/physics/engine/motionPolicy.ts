export type MotionPolicy = {
    // Global System State
    temperature: number;      // 0..1 (Energy/Activity)
    degradeScalar: number;    // 0..1 (Performance Pressure: 0=Clean, 1=MaxThrottle)
    settleScalar: number;     // 0..1 (Rest Confidence: 0=Active, 1=CompletelyStill)
    
    // Derived Response Curves (Global)
    earlyExpansion: number;   // 0..1 (Startup expansion force)
    expansion: number;        // 0..1 (General expansion)
    diffusion: number;        // 0..1 (Jitter smoothing)
    
    // Feature Blends
    hubInertiaBlend: number;
    carrierFlow: number;
    angleResistanceRelief: number;
    
    // Parameter Mappings
    restSpeedSq: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

// Continuous Mapping Functions
export const computeHubScalar = (degree: number): number => {
    // Map degree 1..6 to 0..1
    // Degree 2 (Leaf) -> 0.0
    // Degree 6+ (Super Hub) -> 1.0
    return smoothstep(2.0, 6.0, degree);
};

export const computeDensityScalar = (localDensity: number): number => {
    // Map local neighbor count (area density) to 0..1
    // 0 neighbors -> 0.0
    // 8 neighbors -> 1.0
    return smoothstep(0.0, 8.0, localDensity);
};

export const createMotionPolicy = (
    temperature: number, 
    degradeLevel: number, // Still allow passing raw level, but we'll map it
    avgVelSq: number,
    allowEarlyExpansion: boolean = true
): MotionPolicy => {
    // 1. Temp-based curves
    const earlyExpansion = allowEarlyExpansion ? smoothstep(0.72, 0.9, temperature) : 0;
    const expansion = allowEarlyExpansion ? smoothstep(0.55, 0.75, temperature) : 0;
    const diffusion = smoothstep(0.05, 0.2, temperature);
    const hubInertiaBlend = 1 - smoothstep(0.7, 0.88, temperature);
    const carrierFlow = expansion;
    const angleResistanceRelief = expansion;

    // 2. Degrade Scalar (Continuous)
    // Map discrete levels 0, 1, 2 to continuous 0.0, 0.5, 1.0 (or similar)
    // In future, this should come from raw budget pressure 0..infinity
    const degradeScalar = clamp01(degradeLevel * 0.5); 

    // 3. Settle Scalar (Continuous)
    // Inverse of Velocity. 
    // High Velocity -> 0.0 Settle
    // Near Zero -> 1.0 Settle
    // Thresholds: Moving > 0.25, Microkill < 0.0004
    // We want 1.0 when < 0.0001
    const settleScalar = 1.0 - smoothstep(0.0001, 0.01, avgVelSq);

    const restSpeedSq = 0.01 * 0.01;

    return {
        temperature,
        degradeScalar,
        settleScalar,
        earlyExpansion,
        expansion,
        diffusion,
        hubInertiaBlend,
        carrierFlow,
        angleResistanceRelief,
        restSpeedSq,
    };
};
