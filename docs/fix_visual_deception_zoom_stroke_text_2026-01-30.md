# Fix Report: Visual Deception (Zoom & Wobble)
**Date**: 2026-01-30
**Status**: APPLIED
**Scope**: "Visual Deception" Initiative (Fixes #49, #50, #51)

## 1. Problem Statement
Users perceived "motion" or "instability" where none existed:
1.  **Zoom Breathing (Fix 49)**: Lines grew thicker relative to other elements when zooming, or stayed world-constant which made them look like they were "sliding" at high zoom.
2.  **Text Wobble (Fix 50)**: Labels shifted vertically due to inconsistent font metrics and baseline rounding during renders.
3.  **Aliasing Shimmer (Fix 51)**: Thin lines at fractional widths caused anti-aliasing flicker.

## 2. Solutions Applied

### A. Zoom-Stable Line Thickness (Fix 49)
**Mechanism**: Parametric Scaling in `graphDraw.ts`.
**Logic**:
*   `drawNodes` and `drawLinks` now accept the current `zoom` level.
*   **Formula**: `ctx.lineWidth = theme.width / zoom`.
*   **Result**: The line width in *screen pixels* remains constant regardless of zoom level. A 1px line stays a crisp 1px line, rather than becoming a huge 10px block at 10x zoom.
*   **Clamp**: Implicitly clamped to avoid sub-pixel disappearance (though canvas handles opacity falloff naturally).

### B. Text Stability (Fix 50)
**Mechanism**: Baseline Standardization.
**Logic**:
*   Switched `ctx.textBaseline` from `'top'` to `'middle'`.
*    `'middle'` uses the mathematical center of the glyphs, which is far more stable across font families and zoom levels than the "top" metric (which varies by browser/OS).
*   Added a vertical offset (`fontSize * 0.4`) to visually position the text below the node, maintaining the original design intent but with rock-solid stability.

### C. Anti-Alias Reduction (Fix 51)
**Mechanism**: Consistent Stroke Widths.
**Logic**:
*   By enforcing screen-space constant widths (see Fix 49), we avoid the "fractional world width" issues that caused shimmering. A line is always drawn with a predictable screen footprint.

## 3. Verification Steps
1.  **Zoom Test**:
    - Zoom in/out on a link.
    - *Observation*: The link connection line stays "thin" and does not inflate like a balloon. The node ring stays crisp.
2.  **Text Test**:
    - Pan the camera slowly.
    - *Observation*: The text moves smoothly with the node. It does not "dance" or jitter vertically relative to the node circle.

## 4. Technical Note
This change affects `graphDraw.ts` (render logic) and `useGraphRendering.ts` (passing zoom state). No physics or data logic was touched.
