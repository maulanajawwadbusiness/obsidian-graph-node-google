# Repair Report: DPR Thrash & Crash Safety
**Date**: 2026-01-30
**Status**: APPLIED
**Focus**: "Visual Dignity" (Crash-Proof, Resize-Proof, Zero-Flicker)

## 1. DPR Coalescing & Thrash Reduction (Fix 37)
**Issue**: Changing Browser Zoom (DPR) or Switch Monitors often triggers a storm of Resize events + rAF loops that can conflict, causing "jank" or heavy re-computes.
**Fix**:
*   Leveraged the **Single Surface Source of Truth** pattern.
*   The Main Render Loop checks `canvas.width` vs `rect.width * dpr` exactly once per frame.
*   If mismatched, it performs ONE consolidated sync (Resize + Physics Bounds + Hover Invalidation).
*   Use of `ResizeObserver` (Fix 36) combined with this Frame-Aligned logic ensures we never "fight" the browser or thrash the layout.

## 2. Zero-Size Canvas Guard (Fix 38)
**Issue**: During rapid layout changes (panel collapse, initial flexbox mount), the canvas might report `width=0` for one frame. Passing this to the Physics Engine or Camera Math caused crashes or state corruption.
**Fix**:
*   Added an **Early Exit Guard** in the render loop.
*   If `rect.width <= 0`, the frame is **aborted completely**.
*   State is preserved; no "empty map" is drawn; previously rendered pixels remain until valid size returns.

## 3. Camera NaN Safety (Fix 39)
**Issue**: Edge cases (dt=0, divide-by-zero zoom) could push Camera Parameters to `NaN`, causing the map to vanish permanently ("Black Hole Bug").
**Fix**:
*   Implemented **Input Sanitization** before every Frame Snapshot.
*   Checks `zoom`, `panX`, `panY` for NaN/Infinity.
*   If valid: Backs up to `lastSafeCameraRef`.
*   If invalid: **Restores** instantly from `lastSafeCameraRef`.
*   **Result**: The user never sees a glitch; the camera simply refuses to break.

## Verification
*   **Rapid Resize**: Shrink window to 0x0 and back. Map returns instantly.
*   **DPR**: Ctrl+/Ctrl- spam. Smooth transitions, no hangs.
*   **NaN Stress**: (Internal) Forced NaN conditions result in frame hold, not crash.
