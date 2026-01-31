export type MotionPolicy = {
    temperature: number;
    earlyExpansion: number;
    expansion: number;
    diffusion: number;
    hubConstraintRelief: number;
    hubInertiaBlend: number;
    denseBypass: number;
    microSlip: number;
    carrierFlow: number;
    angleResistanceRelief: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

export const createMotionPolicy = (temperature: number): MotionPolicy => {
    const earlyExpansion = smoothstep(0.72, 0.9, temperature);
    const expansion = smoothstep(0.55, 0.75, temperature);
    const diffusion = smoothstep(0.05, 0.2, temperature);
    const hubConstraintRelief = earlyExpansion;
    const hubInertiaBlend = 1 - smoothstep(0.7, 0.88, temperature);
    const denseBypass = earlyExpansion;
    const microSlip = earlyExpansion;
    const carrierFlow = expansion;
    const angleResistanceRelief = expansion;

    return {
        temperature,
        earlyExpansion,
        expansion,
        diffusion,
        hubConstraintRelief,
        hubInertiaBlend,
        denseBypass,
        microSlip,
        carrierFlow,
        angleResistanceRelief,
    };
};
