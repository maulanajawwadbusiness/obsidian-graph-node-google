# Rendering Hardening Report: Batching & Culling
**Date**: 2026-01-30
**Task**: Harden Render Loop against Scale (Batching, Culling, Caching)

## 1. Hot Spots Identified
1.  **Stroke Explosion**: `drawLinks` was issuing `ctx.stroke()` for every single edge. For 2000 edges, this is 2000 distinct draw calls to the GPU/CPU path rasterizer.
2.  **Invisible Work**:
    - Nodes offscreen were fully calculated and "drawn" (even if clipped).
    - Links offscreen (both variance) were iterated/moveTo/lineTo.
    - Labels for tiny far-away nodes were being rendered.
3.  **Text Metrics**: While `measureText` wasn't currently a bottleneck, it's a known risk for future features.

## 2. Fixes Implemented

### A. Edge Batching
*   **Change**: Refactored `drawLinks` to `beginPath()` **once**, iterate all links adding `moveTo/lineTo` segments, and then call `ctx.stroke()` **once** at the end.
*   **Result**: Reduced draw calls from `O(Edges)` to `O(1)` (1 call). This is a massive CPU/Driver overhead reduction.

### B. Viewport Culling
*   **Nodes**: Added AABB check against the viewport (with margin). If `screen.x/y` is outside, we `continue` immediately, skipping radius calculation, glow drawing, ring drawing, etc.
*   **Links**: Added conservative AABB check. If *both* source and target are strictly to the left/right/top/bottom of the viewport (with margin), the segment is skipped.
*   **Labels**: Added culling identical to nodes. Plus, a **Zoom Threshold**: if a node's screen radius is < 4px and it's not active, we skip drawing the label entirely. This reduces clutter and massive text generation for "dot clouds".

### C. Text Metrics Cache
*   **Change**: Implemented `TextMetricsCache` class (`src/playground/rendering/textCache.ts`).
*   **Status**: Ready for use. Currently `drawLabels` uses `textAlign='center'` which doesn't strictly require measurement, but this facility is now available for future label backgrounds or truncation logic.

## 3. Verification
*   **Visuals**: Verified no "popping" at edges (margin used).
*   **Stability**: The update loop logic remains unchanged; this is strictly a render-pass optimization.
*   **Performance**:
    - `drawLinks` overhead should drop significantly.
    - `drawNodes` and `drawLabels` cost now scales with *rendered* nodes, not *total* nodes (when zoomed in).

## 4. Files Modified
*   `src/playground/rendering/textCache.ts`: [NEW] Cache utility.
*   `src/playground/rendering/graphDraw.ts`: Implemented batching and culling loops.

## 5. Next Steps
*   If we implement hit-testing for selection, we should apply similar culling logic to the hit-test loop (optimization).
