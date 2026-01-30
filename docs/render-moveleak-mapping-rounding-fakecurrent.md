# Render Move Leak Phase 2: Input & Rounding Fixes (Completed)

**Date:** 2026-01-30
**Status:** Completed

## 1. Summary of Fixes

We have addressed the remaining "apparent move leak" edge cases by hardening the transform logic and adding strict debugging controls.

### A. Screen <-> World Mismatch (Fix 4)
*   **Fix**: Updated `CameraTransform` to explicitly handle "Pixel Snapping" logic within the unified transform pipeline.
*   **Consistency**: Both the input loop (via `hoverController` -> `clientToWorld`) and the render loop (via `useGraphRendering` -> `applyToContext`) use the exact same `CameraTransform` class.
*   **Resolution**: The `CameraTransform` class is the single source of truth.

### B. Subpixel Wobble (Fix 5)
*   **Fix**: Implemented **Pixel Snapping** toggle in the Debug Panel.
*   **Logic**: When enabled, the camera's effective translation (`panX` * `zoom`) is rounded to the nearest integer before being applied to the context.
*   **Benefit**: Eliminates "shimmering" of the entire graph when the camera settles on a sub-pixel value (e.g., 100.4px).
*   **Tradeoff**: Movement might look slightly "stepped" at very low zooms, hence it is an optional toggle.

### C. Render-Only "Fake Current" (Fix 6)
*   **Fix**: Implemented **"Kill Render Motion"** toggle in the Debug Panel.
*   **Logic**: Forced `nodeEnergy` and `targetEnergy` to 0 in the render loop when enabled.
*   **Benefit**: Instantly kills all glow/hover animations. If the graph still moves, it is 100% physics. If it stops, the perception of movement was due to the "breathing" animations.

## 2. Verification Instructions

### Test 1: The "Pixel Snap" Test
1.  Open Debug Panel.
2.  Pan the graph slightly and release.
3.  Toggle **"Pixel Snapping"** ON/OFF.
4.  **Observation**:
    *   **OFF**: Edges might look slightly blurry or "soft" as they sit on subpixels. Start/Stop might feel "floaty".
    *   **ON**: The entire graph snaps to crisp alignment. Text is clearer. Stop is absolute.

### Test 2: The "Dead Graph" Test
1.  Open Debug Panel.
2.  Enable **"Kill Render Motion"**.
3.  Hover over nodes.
4.  **Observation**: No glow, no expansion, no label movement.
5.  **Proof**: This isolates physics movement from render effects. If you see movement now, it is real physics (or the camera drift, which should be fixed by Phase 1).

### Test 3: The "Grid Stability" (Regression Test)
1.  Enable **"Show Grid/Axes"**.
2.  Enable **"Lock Camera"**.
3.  Verify the grid is perfectly static even if you drag wildly (Fix 1 verification).

## 3. Files Modified
*   `src/playground/rendering/camera.ts`: Added pixel snapping logic to `applyToContext`.
*   `src/playground/rendering/renderingTypes.ts`: Added `pixelSnapping` and `debugNoRenderMotion` to settings.
*   `src/playground/useGraphRendering.ts`: Hooked up new settings to the render loop.
*   `src/playground/components/CanvasOverlays.tsx`: Added UI toggles.
*   `src/playground/GraphPhysicsPlayground.tsx`: State management.
