# Render Move Leak & Camera Drift Fix (Completed)

**Date:** 2026-01-30
**Status:** Completed

## 1. Summary of Changes

We have eliminated the "Apparent Move Leak" by addressing three core issues in the rendering layer.

### A. Sub-Pixel Drift (The "Creep")
*   **Fix**: Implemented a **Deadzone (0.5px)** in `updateCameraContainment`.
*   **Result**: The camera ignores sub-pixel physics noise. If the centroid jitters by 0.1px, the camera remains perfectly still.

### B. Infinite Lerp (The "Tail")
*   **Fix**: Implemented **Epsilon Snapping (0.05px)**.
*   **Fix**: Switched from constant-factor smoothing to **DT-Correct Decay** (`1 - exp(-lambda * dt)`).
*   **Result**: Camera motion resolves completely to an integer-stable state after movement stops. No more "Zeno's Paradox" shimmering.

### C. Split Transform Logic (The "Wobble")
*   **Fix**: Introduced `CameraTransform` class (Singleton-like logic, instance per frame).
*   **Logic**: `Screen = Center + Zoom * (Pan + RotateAround(World, Centroid))`.
*   **Unification**: Both the Render Loop (`useGraphRendering`) and Input Loop (`hoverController`) now use exactly the same class to generate matrices, guaranteeing 1:1 mapping.

## 2. Verification Instructions

We have added new Debug Tools to the overlay to verify these fixes.

### Test 1: The "Camera Lock" (Verify Independent Layers)
1.  Open Debug Panel.
2.  Enable **"Lock Camera"**.
3.  Drag the graph around or let physics run.
4.  **Observation**: The nodes move, but the camera viewport is STONE COLD FROZEN.
5.  **Proof**: This proves that any remaining movement is *actual physics*, not render drift.

### Test 2: The "Grid Test" (Verify Transform Stability)
1.  Enable **"Show Grid/Axes"**.
2.  See the Cyan Grid (World Space) and Magenta Cross (Centroid).
3.  Pan/Zoom the graph.
4.  **Observation**: The Cyan Grid moves exactly with the nodes. The Magenta Cross stays exactly on the cluster center.
5.  **Proof**: This proves the `CameraTransform` matrix correctly maps World Space to Screen Space even under rotation and zoom.

### Test 3: The "Hands-Off" Snap
1.  Disable "Lock Camera".
2.  Pan the graph violently and release.
3.  **Observation**: The view glides smoothly and then **SNAPS** to a stop.
4.  **Proof**: No lingering sub-pixel creep. The image becomes static.

## 3. Files Modified
*   `src/playground/rendering/camera.ts`: Core logic (Deadzone, Snap, Transform Class).
*   `src/playground/rendering/hoverController.ts`: Adopted `CameraTransform`.
*   `src/playground/rendering/renderingTypes.ts`: Added types.
*   `src/playground/useGraphRendering.ts`: Integration & Debug Grid.
*   `src/playground/components/CanvasOverlays.tsx`: UI Toggles.
*   `src/playground/GraphPhysicsPlayground.tsx`: State management.
