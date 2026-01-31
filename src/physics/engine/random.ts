/**
 * Deterministic Pseudo-Random Number Generator
 * Using a simple hash function (Mulberry32-like behavior) for simulation stability.
 * Replaces Math.random() where simulation state must be reproducible.
 */
export const pseudoRandom = (seed: number): number => {
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Hash a string to a 32-bit integer.
 */
export const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};
