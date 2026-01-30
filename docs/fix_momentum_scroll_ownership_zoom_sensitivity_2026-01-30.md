# Fix Report: Momentum Reset, Wheel Ownership & Zoom Sensitivity
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/physics/engine.ts`, `src/playground/useGraphRendering.ts`, `src/playground/rendering/hoverController.ts`

## 1. Executive Summary
We addressed the "Haunted Inputs" where user actions had invisible biases (old momentum), ambiguous effects (page scroll vs zoom), or inconsistent feel (zoom-dependent sensitivity).
*   **Drag**: **CLEAN SLATE**. New drags zero out all historical motion/inertia.
*   **Wheel**: **OWNED**. Canvas captures wheel for Zoom/Pan, blocking page scroll.
*   **Sensitivity**: **NORMALIZED**. Hit testing thresholds are now Screen-Space Stable (constant pixel size).

## 2. Root Cause Analysis

### A. Momentum Bias (Defect 22)
*   **Symptom**: Dragging a dot felt "curved" or pre-biased by its previous motion.
*   **Cause**: `grabNode` zeroed `vx/vy` but left `prevFx`, `prevFy`, and `correctionResidual` intact. The integrator used these to continue applying "ghost forces" from the previous frame.
*   **Fix**: `grabNode` now clears `prevFx/y`, `correctionResidual`, and `lastCorrectionDir`.

### B. Ambiguous Scroll (Defect 23)
*   **Symptom**: Wheeling on canvas scrolled the page, or felt "missing".
*   **Cause**: No `wheel` event listener was attached to the canvas, so the browser default (Page Scroll) won.
*   **Fix**: Added a native `wheel` listener with `{ passive: false }` to `useGraphRendering`. It calls `preventDefault()` and implements a standard Exponential Zoom centered on the cursor.

### C. Zoom-Dependent Sensitivity (Defect 24)
*   **Symptom**: Hard to grab nodes when zoomed out (targets too small) or accidental grabs when picked in.
*   **Cause**: Hit testing used a fixed World Unit padding (`hoverHitPaddingPx`). At 0.1x zoom, 15px World Padding became 1.5px Screen Padding (unclickable).
*   **Fix**: Injected `zoom` into `evaluateNode`. The padding is now `padding / zoom`. This ensures 15px World Padding *Screen Projection* is constant?
    *   Actually: `hitRadius = outerRadius + padding / zoom`.
    *   OuterRadius is World. Padding/Zoom is World.
    *   World Distance check: `dist < hitRadius`.
    *   `dist` is World. `outerRadius` is World.
    *   `padding / zoom` is World length that projects to `padding` pixels on screen.
    *   (Px = World * Zoom => World = Px / Zoom).
    *   Yes, this Logic is correct. It creates a constant Screen-Space "Halo" around the node.

## 3. Verification Steps

### Manual Validation
1.  **Flick & Grab**: Flick a node, let it fly, then grab it. **Expectation**: It stops dead instantly. No curve.
2.  **Wheel Isolation**: Scroll wheel over canvas. **Expectation**: Canvas zooms, page does NOT scroll. Scroll over sidebar -> Sidebar scrolls.
3.  **Zoom Click**: Zoom out to 0.1x. Hover a node. **Expectation**: The "Glow" activates at a reasonable distance (e.g. 15px visual), not requiring pixel-perfect precision.

## 4. Conclusion
Inputs are now "WYSIWYG" (What You See Is What You Get) and "WYFIWYG" (What You Feel Is What You Get). Reference frames for interaction match the user's screen perception.
