# Fix Report: Chunked Movement, Deadzone & Snap Softening
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/playground/useGraphRendering.ts`, `src/playground/rendering/camera.ts`

## 1. Executive Summary
We addressed "Micro-Movement" issues where valid inputs were ignored (deadzone), movement felt stair-stepped (frame drops), or position snapped visibly.
*   **Drag**: **CONTINUOUS**. Dragged nodes now update at full render rate (e.g. 144hz) regardless of physics tick rate (60hz) or drops.
*   **Deadzone**: **SUB-PIXEL**. Camera follow deadzone reduced to 0.1 screen pixels (normalized by zoom).
*   **Snap**: **INVISIBLE**. Camera snap threshold reduced to 0.01 screen pixels.

## 2. Root Cause Analysis

### A. Chunked Drag (Defect 28)
*   **Symptom**: Dragging a node fast caused it to stutter or lag behind the cursor.
*   **Cause**: The dragged node's position was only updated inside the Physics Tick (`engine.tick`). If the renderer ran faster than physics, or if physics frames were skipped (due to load), the node visual position remained stale while the cursor moved.
*   **Fix**: Added a "Visual Dignity" pass in the Render Loop (`useGraphRendering.ts`). Every frame, before drawing, we force the dragged node's `x/y` to `engine.dragTarget`. This guarantees 1:1 coupling.

### B. Input Deadzone (Defect 29)
*   **Symptom**: Micro-adjustments to the view were ignored.
*   **Cause**: The camera auto-follow logic had a fixed World Unit deadzone (`0.5`). When zoomed in, `0.5` world units could be `50` pixels, freezing the camera.
*   **Fix**: Changed deadzone to be Screen Space (`0.1 / zoom`). Now it is always 0.1 pixels on screen, effectively invisible but preventing float drift.

### C. Snap Aggression (Defect 30)
*   **Symptom**: Camera would "stick" then "jump" to target.
*   **Cause**: The snap-to-target threshold (`0.05` world units) was too large at high zoom, causing visible teleports.
*   **Fix**: Changed snap threshold to Screen Space (`0.01 / zoom`). It now only snaps when the error is sub-sub-pixel (effectively zero).

## 3. Verification Steps

### Manual Validation
1.  **High-Speed Drag**: Drag a node wildly. It should lock to the cursor crosshair without strobing or lagging.
2.  **Zoomed Micro-Pan**: Zoom in 10x. Nudge the view slightly. It should track.
3.  **Rest Test**: Release the view. It should glide to a stop without a final "tick" or jump.

## 4. Conclusion
Motion is now fluid, coupled 1:1 with input, and free of quantization artifacts.
