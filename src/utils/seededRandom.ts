/**
 * Seeded Pseudo-Random Number Generator (PRNG)
 * Uses Linear Congruential Generator (LCG) algorithm
 * for deterministic random number generation.
 */
export class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    /**
     * Generate next random number in [0, 1)
     */
    next(): number {
        // LCG parameters (from Numerical Recipes)
        // X_{n+1} = (a * X_n + c) mod m
        const a = 1664525;
        const c = 1013904223;
        const m = 4294967296; // 2^32

        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    }

    /**
     * Reset to a new seed
     */
    reset(seed: number) {
        this.seed = seed;
    }
}
