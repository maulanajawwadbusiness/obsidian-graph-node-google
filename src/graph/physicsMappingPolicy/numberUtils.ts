/**
 * Number Utilities
 *
 * Helper functions for numeric validation and clamping.
 */

/**
 * Check if a number is finite (not NaN or Infinity).
 */
export function isFinite(value: number): boolean {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Clamp a number to [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Safe division (returns 0 if divisor is 0).
 */
export function safeDivide(numerator: number, divisor: number): number {
    return Math.abs(divisor) < Number.EPSILON ? 0 : numerator / divisor;
}

/**
 * Check if a number is within range [min, max].
 */
export function inRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}
