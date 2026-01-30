# Repair Report: DPR Extreme Edge Cases
**Date**: 2026-01-30
**Status**: APPLIED
**Focus**: "Visual Dignity" (Stable Resolution, Zero-Jank Monitor Swaps)

## 1. Safe DPR Read (Fix 40)
**Issue**: Transient browser states (iframe loading, unmounted) or bugs can report `devicePixelRatio` as 0, undefined, or massive outliers (e.g. 15.0), causing NaNs or memory explosions.
**Fix**:
*   Implemented **Sanitization Logic** in the render loop.
*   Fallback: `0`, `Inf`, `NaN` -> `1.0`.
*   Clamp: `0.1` to `8.0` (Supports 8K screens but blocks memory bombs).

## 2. Rapid DPR Stabilization (Fix 41)
**Issue**: Moving a window between two monitors with different scaling (e.g., 100% vs 150%) triggers a "flurry" of DPR change events (~10-50 per second) as the OS transitions. This caused repeated canvas resizing/clearing, looking like a glitch storm.
**Fix**:
*   Implemented a **Stability Debounce** (4-Frame Hysteresis).
*   The renderer continues using the *old* DPR until the *new* DPR value persists for ~64ms (4 frames at 60hz).
*   **Result**: The user sees ONE clean resolution snap after the transition performs, rather than 10 flickers during the move.

## Verification
*   **Monitor Swap**: Drag window between screens. Map stays stable, then snaps sharp once.
*   **Invalid State**: Mocked `window.devicePixelRatio = 0`. App stayed at 1.0 scale, no crash.
*   **Performance**: ResizeObserver loops and Canvas Reallocations are reduced to absolute minimum necessary.
