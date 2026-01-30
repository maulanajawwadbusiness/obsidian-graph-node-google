# Rendering Hardening Report: Cache Lifecycle
**Date**: 2026-01-30
**Task**: Invalidate Stale Projection/Hit Caches and Bound Memory Growth

## 1. Hot Spots Identified
1.  **Stale Hit Testing**: `updateHoverSelection` could run on a frame where the camera had moved but the mouse hadn't, using potentially stale "screen" coordinates or a stale "last hovered" ID.
2.  **Unbounded Caches**: `TextMetricsCache` and `GradientCache` used a simple "clear all" (or no limit) strategy. This is risky for long-running sessions or high-variety content (many node labels).
3.  **Variable Shadowing**: Found and fixed a critical bug where `settingsRef` and `cameraRef` were accidentally re-initialized inside the render loop, potentially disconnecting the renderer from React state controls.

## 2. Fixes Implemented

### A. Generation-based Invalidation
*   **Change**: Introduced `globalSurfaceGeneration` in `graphRenderingLoop.ts`.
*   **Logic**: `HoverState` now tracks `surfaceGeneration` and `cameraKey`.
*   **Impact**: If the surface resizes (DPR change) or camera moves (Pan/Zoom), `updateHoverSelectionIfNeeded` FORCES a re-computation of the hit test, even if the mouse pointer is idle. This prevents the "hover cue stuck on screen" artifact.

### B. Bounded LRU Eviction
*   **Change**: Refactored `TextMetricsCache` and `GradientCache` to use a Least-Recently-Used (LRU) policy.
*   **Mechanism**:
    - On Access: Delete and Re-Set the key (promotes to newest).
    - On Overflow: Delete `map.keys().next().value` (the oldest).
*   **Limits**: Set conservative limits (e.g. 5000 for text, 2000 for gradients) to ensure memory usage is stable O(1) rather than O(N).

### C. Syntax & Logic Cleanup
*   **Fix**: Removed invalid syntax inside `schedulerState` object literal.
*   **Fix**: Removed accidental shadowing of `cameraRef`/`settingsRef` inside the loop function.

## 3. Verification
*   **Hit Logic**: Code manually tracks `lastClientX/Y` and re-submits them to the hit tester when generations change.
*   **Memory**: LRU logic ensures maps never exceed `maxCacheSize`.

## 4. Files Modified
*   `src/playground/rendering/graphRenderingLoop.ts`: Hit logic, generation tracking.
*   `src/playground/rendering/textCache.ts`: LRU implementation.
*   `src/playground/rendering/gradientCache.ts`: LRU implementation.
*   `src/playground/rendering/renderingTypes.ts`: Added generation fields to `HoverState`.
