# Fix Report: Visual Trust (Cues & Glow)
**Date**: 2026-01-30
**Status**: APPLIED
**Scope**: "Visual Trust" Initiative (Fixes #46, #47, #48)

## 1. Problem Statement
The application's visual feedback had subtle "lies" that eroded trust:
1.  **Cue Disagreement (Fix 46)**: Dragging Node A over Node B could cause Node B to light up as "hovered," confusing the user about which node was active.
2.  **Reference Drift (Fix 47)**: Interaction caused the world to drift unpredictably. (Addressed via previous Law Lock/Centroid fixes).
3.  **Off-Center Glow (Fix 48)**: The CSS/Canvas `blur()` filter had subpixel biases, making the glow look shifted relative to the node core.

## 2. Solutions Applied

### A. Cue Lock (Fix #46)
**Mechanism**: Parametric Override in `hoverController.ts`.
**Logic**:
*   `updateHoverSelection` now accepts `lockedNodeId`.
*   During a drag (`engine.draggedNodeId` exists), this ID is passed down.
*   **The Lock**: If a locked ID is present, the entire KD-tree/proximity search is **bypassed**.
*   **Forced Result**: The hovered state is forcibly set to the dragged node.
*   **Energy Maintenance**: The locked node is given `targetEnergy = 1.0` to ensure it stays glowing/active regardless of mouse distance (as long as drag continues).

### B. Glow Centering (Fix #48)
**Mechanism**: Mathematical Gradient replacing Filter Blur.
**Logic**:
*   *Old*: `ctx.filter = 'blur(10px)'`. Implementation dependent, often top-left biased by incomplete kernel windowing.
*   *New*: `ctx.createRadialGradient(x, y, r, x, y, r + blur)`.
*   **Math**: Using a radial gradient ensures the color falloff is calculated from the exact `(x,y)` center of the node, identical to the core circle.
*   **Benefit**: Pixel-perfect centering at any zoom level. Smoother, "more premium" look.

## 3. Verification Steps
1.  **Cue Lock**:
    - Drag a node through a dense cluster.
    - *Observation*: Only the dragged node glows. Nodes underneath it do *not* light up.
2.  **Glow Center**:
    - Zoom to 500%.
    - *Observation*: The glow halo is perfectly symmetric around the node.
3.  **Reference Stability**:
    - Drag graph; ensure no "swimming" or drift of camera/world.

## 4. Technical Note
The move to `RadialGradient` is slightly more expensive than `blur()` on some GPUs, but insignificant for the node counts (< 2000) we support. The gain in visual precision is worth the tradeoff.
