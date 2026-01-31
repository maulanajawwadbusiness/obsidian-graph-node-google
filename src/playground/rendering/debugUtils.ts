// @ts-nocheck
/**
 * Debug Gating Utility
 * Ensures debug visuals/logic are stripped or disabled in production.
 */

// Compile-time check (bundlers replace process.env.NODE_ENV)
export const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Check if a debug feature should be active.
 * ALWAYS returns false in production, regardless of flag.
 */
export function isDebugEnabled(flag: boolean): boolean {
    return IS_DEV && flag;
}

/**
 * Execute a debug-only function.
 * Optimized to be eliminated by minifiers if IS_DEV is false.
 */
export function runDebug(fn: () => void): void {
    if (IS_DEV) {
        fn();
    }
}
