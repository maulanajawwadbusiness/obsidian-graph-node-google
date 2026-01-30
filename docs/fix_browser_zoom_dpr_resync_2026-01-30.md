# Fix Report: Browser Zoom & DPR Resync
**Date**: 2026-01-30
**Status**: APPLIED
**Scope**: "User Eyes" Initiative (Fix #56)

## 1. Problem Statement
Changing the browser zoom (Ctrl+/Ctrl-) or moving the window between screens with different scaling factors (DPR) caused immediate visual degradation and input misalignment.
1.  **Blurry Text/Lines**: The canvas backing store resolution did not update to match the new `devicePixelRatio`.
2.  **Input Offset**: The `clientToWorld` mapping relied on stale cached `rect` or implicitly assumed stablity, causing cursor clicks to miss their targets.

## 2. Solutions Applied

### A. Robust DPR Detection (Fix #56)
**Mechanism**: Render-loop detection in `useGraphRendering.ts`.
**Logic**:
*   Track `lastDPR` in a Ref.
*   Every frame (60fps), check:
    1.  `window.devicePixelRatio !== lastDPR.current`
    2.  `canvas.width !== Math.round(rect.width * dpr)` (Size mismatch)
*   **Action**: If triggered:
    *   Update `canvas.width` / `canvas.height` immediately to `rect * dpr`.
    *   Call `engine.updateBounds`.
    *   Update `lastDPR.current`.
    *   Reset transform `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
*   **Result**: The canvas snaps instantly to the new resolution. No blur.

### B. Continuous Projection (Fix #55 Support)
*   The prior Fix #55 ensures that `engine.dragTarget` is updated using the *fresh* `rect` and `camera` state every frame.
*   Combined with Fix #56, this means even if the zoom changes *during* a drag, the node stays locked to the mouse cursor because the coordinate system updates synchronously before the drag position is applied.

## 3. Verification Steps
1.  **Zoom Quality**:
    - Open app. Observe text crispness.
    - Zoom to 150% (Ctrl+).
    - *Observation*: Text remains crisp (re-rasterized at higher res). Canvas fills space correctly.
2.  **Input Alignment**:
    - Zoom to 80% (Ctrl-).
    - Hove over a node.
    - *Observation*: Hitbox aligns perfectly with visual circle.
3.  **Stress Test**:
    - Drag a node. While holding left-click, press Ctrl+ to zoom.
    - *Observation*: The node should remain grabbed. It might shift position on screen (due to layout flow) but should stay under the mouse pointer in world space.
