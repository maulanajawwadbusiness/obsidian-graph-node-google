# Fix: Camera Transform Correctness (Order & Anchor)

**Date**: 2026-01-30
**Agent**: Antigravity
**Subject**: Input/Render Math Synchronization

## 1. Problem
User interactions (Hover/Drag) drifted from the visual representation during:
1.  **Rotation**: If a node swarm was rotating, the "Pivot" (Centroid) used for rendering (t=0) differed from the Pivot used for hit-testing (t=16ms), causing the click to miss the node.
2.  **Context Compounding**: Hypothetical risk of `ctx.transform` accumulating errors if not reset strict frame-by-frame.

## 2. Solutions

### A. Shared Pivot (Anchor) in Snapshot
*   **Change**: Added `centroid` to `CameraState` and `FrameSnapshot`.
*   **Mechanism**:
    *   **Render Loop**: Calculates `engine.getCentroid()`, saves it to `cameraRef.current.centroid`.
    *   **Snapshot**: Freezes this `centroid` alongside `pan/zoom` into the `FrameSnapshot`.
    *   **Input**: `clientToWorld` reads `snapshot.camera.centroid`.
*   **Impact**: Even if the physics engine continues to simulate and move the swarm center, the interaction layer uses the *Frame Frozen Pivot*. The mouse cursor rotates around the same point as the pixels on screen.

### B. Canonical Transform Chain
*   **Logic**: `Screen = Center + Zoom * (Pan + RotateAround(World, Anchor))`
*   **Implementation**: Verified that `CameraTransform.applyToContext` (Render) and `CameraTransform.worldToScreen` (Mapping) use identical Order of Operations.
*   **Strict Reset**: Confirmed `useGraphRendering` calls `ctx.setTransform(dpr, ...)` at start of frame, and all sub-draw routines use `withCtx` (save/restore).

## 3. Verification
*   [x] **Rotation Stability**: Selection remains locked to node even if global angle is animated.
*   [x] **Drag Consistency**: dragging a node does not cause it to spiral out due to mismatched pivot.
*   [x] **Canvas Safety**: No runaway scaling or drift after minutes of interaction.

## 4. Code Changes
*   `src/playground/rendering/renderingTypes.ts`: Added `centroid` to `CameraState`.
*   `src/playground/useGraphRendering.ts`: Added Capture logic.
*   `src/playground/rendering/hoverController.ts`: Updated consumption logic.
