# Repair Report: Input After-Effects & Stale Caches
**Date**: 2026-01-30
**Status**: APPLIED
**Focus**: "Visual Dignity" (Stopping the world when you stop; Truthful Hover)

## 1. Trackpad Inertia (Tail) Killing (Fix 31)
**Issue**: Modern trackpads send a stream of decaying "inertial" wheel events after your fingers leave the surface. This causes the camera to drift or "float" for seconds, making precision docking difficult ("The system has will").
**Fix**: Implemented variable active gating in the Wheel Handler.
*   **Threshold**: Any normalized delta < 0.5px is strictly ignored.
*   **Result**: The moment the input energy drops below noticeable levels, the world stops. This gives a "solid" friction feel rather than a "hovercraft" feel.

## 2. Surface-Driven Cache Invalidation (Fix 32)
**Issue**: When resizing the browser or changing screens (DPR change), internal caches for hit-testing and snapping could remain stale for one frame, or until the next mouse move.
**Fix**:
*   The Main Render Loop now explicitly monitors `canvas.width` vs `rect.width * dpr`.
*   On mismatch, it sets a `surfaceChanged` flag.
*   This flag forces an immediate `engine.updateBounds`, ensuring physics boundaries match visual boundaries in the same frame.

## 3. Hover Stale Rect Sync (Fix 33)
**Issue**: If you resized the window while hovering a node (without moving the mouse), the "Hover" highlight would remain on the old screen coordinates, detaching from the node.
**Fix**:
*   Connecting to the `surfaceChanged` flag above.
*   The `updateHoverSelection` routine is now triggered if `(cameraChanged || surfaceChanged)`.
*   It re-projects the *last known pointer position* against the *new* Surface/Camera matrix.
*   **Result**: If you resize the window, the hover glow stays glued to the node as it moves reflows.

## Verification
*   **Trackpad**: Fling scale; camera should stop promptly, not drift forever.
*   **Resize**: Hover a node, drag window handle. Glow should track the node.
*   **DPR**: Drag window between 1x and 2x screens. Hit testing should remain accurate (no offset clicks).

**System Health**: Zero Ghost Input.
