# Fix Report: Pan Rotation alignment & Hand Priority
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/playground/rendering/camera.ts`, `src/playground/useGraphRendering.ts`, `src/physics/engine/corrections.ts`, `src/physics/engine/constraints.ts`

## 1. Executive Summary
We addressed the "Haunted Mapping" issues where user intent (Drag Right) produced mismatched results (Diagonal Pan) or fought against the simulation (Sideways Drift, Snapping).
*   **Pan**: **ROTATION-CORRECTED**. Pan inputs now respect the rotated reference frame.
*   **Drift**: **DAMPENED**. Local diffusion is silenced near the hand to prevent "Sideways Squirt".
*   **Constraints**: **YIELDING**. Edges connected to the hand are softer to prevent snapping.

## 2. Root Cause Analysis

### A. Pan Applied in Rotated Space (Defect 19)
*   **Symptom**: User drags right, world moves diagonal (when rotated).
*   **Cause**: `updateCameraContainment` calculated the required pan vector in **World Coordinates** (e.g. `(-100, 0)`), but the `CameraTransform` stack applies the Pan translation *before* the Rotation.
    *   `ctx.translate(Pan); ... ctx.rotate(Angle);`
    *   This effectively means the "Pan" parameter interprets `(x, y)` as `(x_unrotated, y_unrotated)`.
    *   Feeding it a World-Aligned vector (`-centroid`) caused it to act as a Screen-Aligned offset, breaking alignment when `Angle != 0`.
*   **Fix**: Modified `updateCameraContainment` to **counter-rotate** the required pan vector by `Angle`.
    *   `Pan_screen = R(-Angle) * Pan_world`.
    *   This aligns the applied pan with the screen axes, cancelling the subsequent rotation.

### B. Sideways Drift (Defect 20)
*   **Symptom**: Dragging a dot caused neighbors to drift sideways.
*   **Cause**: The `applyCorrectionsWithDiffusion` pass spreads positional noise/pressure to neighbors. In a dense cluster, this "pressure release" often squirts perpendicular to the drag direction.
*   **Fix**: Updated `corrections.ts` to check if a node is a neighbor of `engine.draggedNodeId`. If so, we dampen the received diffusion by 80% (`localDamping = 0.2`).

### C. Constraint Snapping (Defect 21)
*   **Symptom**: Dot feels like it's fighting the hand / moving opposite.
*   **Cause**: PBD Edge Relaxation tries to maintain exact distance. If the user moves the hand faster than the solver converges, or into a high-tension state, the constraint "snaps" the neighbor back.
*   **Fix**: Modified `applyEdgeRelaxation` in `constraints.ts`. If an edge is connected to the hand, its stiffness is reduced by 70%, giving the user "Hand Priority" over the physics.

## 3. Verification Steps

### Manual Validation
1.  **Rotation Pan**: Rotate camera to 45 degrees. Drag a node far right. **Expectation**: The camera (if following) pans horizontally on screen, not diagonally.
2.  **Cluster Drag**: Drag a node linearly through a cluster. **Expectation**: Neighbors trail behind or separate cleanly; they do not fly off sideways.
3.  **Fight Test**: Shake a node violent. **Expectation**: The link to neighbors acts viscoelastic/soft, avoiding rigid snapping.

## 4. Conclusion
The mapping from "Hand Pixel Delta" to "World Reaction" is now mathematically consistent and perceptually prioritized.
