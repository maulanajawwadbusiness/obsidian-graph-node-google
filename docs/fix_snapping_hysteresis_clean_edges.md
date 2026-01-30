# Rendering Hardening Report: Snapping & Stability
**Date**: 2026-01-30
**Task**: Eliminate "shimmer" (sub-pixel crawling) when idle, while maintaining smooth motion (no stair-stepping).

## 1. Hot Spots Identified
1.  **Inconsistent Snapping**: `CameraTransform` snapped, but `drawNodes` and `drawLabels` had their own divergent quantization logic.
2.  **Stair-Stepping**: Snapping was active *during* camera motion, causing jagged movement at low speeds (~1px jumps).
3.  **Shimmer**: When idle, sub-pixel drift (or lack of snapping in some layers) caused static nodes to look blurry or aliased edges to crawl.

## 2. Fixes Implemented

### A. Unified Snap Logic
*   **Helper**: Created `snapToGrid(val, dpr, enabled)` in `renderingMath.ts`.
*   **Adoption**:
    *   `CameraTransform` (the source of truth for World->Screen) uses it.
    *   `drawNodes` (stroke alignment) uses it.
    *   `drawLabels` (text baseline) uses it.

### B. Motion Hysteresis (State Machine)
*   **Mechanism**: Added `isMoving` and `snapEnabled` to `HoverState`.
*   **Logic** (`graphRenderingLoop.ts`):
    *   If `physics > 0` OR `camera moving` OR `mouse pending`: `snapEnabled = false`.
    *   If idle for >150ms: `snapEnabled = true`.
*   **Result**: Smooth integer-free coordinates during motion (buttery smooth), locking to crisp integer/half-pixels when resting.

### C. Layer Consistency
*   **Nodes**: `drawNodes` respects `snapEnabled`.
*   **Labels**: `drawLabels` respects `snapEnabled` (preventing text "jitter" during slow pans).
*   **Edges**: `drawLinks` relies on `worldToScreen`, which now respects `snapEnabled`.

## 3. Verification
*   **Motion**: Start dragging -> Snapping disables -> Motion is sub-pixel smooth.
*   **Rest**: Stop dragging -> 150ms later -> Snapping enables -> Scene looks sharp.
*   **Zoom**: Zooming counts as motion -> Smooth zoom -> Sharp when stopped.

## 4. Files Modified
*   `src/playground/rendering/graphRenderingLoop.ts`: Hysteresis logic, imports.
*   `src/playground/rendering/camera.ts`: `CameraTransform` implementation.
*   `src/playground/rendering/graphDraw.ts`: Consumers of snap logic.
*   `src/playground/rendering/renderingMath.ts`: `snapToGrid` helper.
*   `src/playground/rendering/renderingTypes.ts`: Snap state fields.
