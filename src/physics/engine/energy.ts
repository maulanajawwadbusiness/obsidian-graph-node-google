export type EnergyEnvelope = {
    energy: number;
    forceScale: number;
    effectiveDamping: number;
    maxVelocityEffective: number;
};

export const computeEnergyEnvelope = (lifecycle: number): EnergyEnvelope => {
    // τ (tau) = time constant. After τ seconds, energy is ~37% of initial.
    // After 3τ, energy is ~5%. After 5τ, energy is ~0.7%.
    const tau = 0.3; // 300ms time constant
    const energy = Math.exp(-lifecycle / tau);

    // Energy envelope:
    // - At t=0: energy=1.0 (full forces, low damping)
    // - At t=300ms: energy≈0.37
    // - At t=600ms: energy≈0.14
    // - At t=1s: energy≈0.04 (imperceptible)
    // - Never reaches exactly 0

    // Force effectiveness scales with energy
    const forceScale = energy;

    // Damping increases as energy decreases (from 0.3 to 0.98)
    const baseDamping = 0.3;
    const maxDamping = 0.98;
    const effectiveDamping = baseDamping + (maxDamping - baseDamping) * (1 - energy);

    // Max velocity decreases with energy
    const maxVelocityEffective = 50 + 1450 * energy; // 1500 → 50

    return {
        energy,
        forceScale,
        effectiveDamping,
        maxVelocityEffective,
    };
};
