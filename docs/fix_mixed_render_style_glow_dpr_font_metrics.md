# Rendering Hardening Report: Architecture & Invalidation
**Date**: 2026-01-30
**Task**: Unify Render Styles and Invalidate Caches on Environmental Changes

## 1. Hot Spots Identified
1.  **Mixed Render Styles**: The Debug Overlay was using `ctx.transform()` while the rest of the app (Nodes, Edges) used Manual Projection. This risks "drift" where debug visuals detach from their targets due to different precision or projection logic.
2.  **Stale Caches on DPR Change**: `GradientCache` (and potentially others) were not cleared when moving windows between monitors or resizing, leading to blurry glows.
3.  **Layout Shifts**: Label width metrics cached in `TextMetricsCache` became stale when web fonts finished loading, causing permanent incorrect label centering/truncation.

## 2. Fixes Implemented

### A. Canonical Render Style (Manual Projection)
*   **Change**: Refactored `drawHoverDebugOverlay` to accept `worldToScreen` and use it explicitly. Removed the `ctx.save/restore` block that applied the camera matrix.
*   **Impact**: Debug visuals now share the exact same projection pipeline as the nodes they annotate. Visual consistency is mathematically guaranteed.

### B. Cache Invalidation
*   **DPR/Resize**: Added `gradientCache.clear()` and `textMetricsCache.clear()` to `updateCanvasSurface` in the render loop. This ensures that any change to the backing buffer resolution (pixel ratio) immediately regenerates resolution-dependent assets.
*   **Font Loading**: Added a one-time header listener for `document.fonts.ready` (and `loadingdone` event) in `startGraphRenderLoop`. When fonts load, `textMetricsCache` is wiped, forcing the next frame to re-measure all text with the correct font metrics.

## 3. Verification
*   **Drift Test**: Code analysis confirms both debug and node drawing use `worldToScreen`.
*   **DPR Test**: Code analysis confirms `clear()` is part of the resize logic.
*   **Font Test**: The listener explicitly hooks into the standardized Font Loading API.

## 4. Files Modified
*   `src/playground/rendering/graphDraw.ts`: Debug overlay projection logic.
*   `src/playground/rendering/graphRenderingLoop.ts`: Cache clearing logic and render pass ordering.

## 5. Next Steps
*   If we add more caches (e.g. for path geometry), they must be added to the `updateCanvasSurface` invalidation block.
