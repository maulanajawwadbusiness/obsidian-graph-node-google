# Fix Report: Ghost Slide, Jitter & Camera Drift
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/physics/engine.ts`, `src/playground/useGraphRendering.ts`

## 1. Executive Summary
We addressed three "User Eyes" defects where the simulation undermined the user's hand authority.
*   **Ghost Slide**: Fixed. Nodes now stop atomically on release.
*   **Micro Jitter**: Fixed. Nodes are now `isFixed=true` (Immutable) during drag.
*   **Camera Drift**: Fixed. Camera tracking is suspended while dragging.

## 2. Root Cause Analysis

### A. Ghost Slide (Defect 13)
*   **Symptom**: Dots kept sliding after release.
*   **Cause**: `releaseNode` only multiplied velocity by `0.1`. It failed to clear:
    *   `prevFx / prevFy` (Force Memory)
    *   `lastCorrectionDir` (Directional Inertia)
    *   `correctionResidual` (Unpaid Constraint Debt)
*   **Fix**: Implemented "Atomic Release" in `engine.ts`. All motion state is explicitly zeroed.

### B. Micro Jitter (Defect 14)
*   **Symptom**: Vibrating dot under cursor.
*   **Cause**: Race condition between `moveDrag` (User Input) and `integrateNodes`/`constraints` (Physics). The physics engine tried to "solve" the dragged node's position against its neighbors, fighting the mouse.
*   **Fix**:
    *   **Grab**: Set `node.isFixed = true`.
    *   **Release**: Set `node.isFixed = false`.
    *   **Mechanism**: The existing `isFixed` checks in `constraints.ts` and `corrections.ts` now correctly ignore the dragged node, leaving it 100% under user control.

### C. Camera Drift (Defect 15)
*   **Symptom**: World shifted while dragging, making it feel like walking on a treadmill.
*   **Cause**: `updateCameraContainment` continued to recenter the view based on the changing AABB of the graph, which naturally expands/contracts as you drag a node.
*   **Fix**: Gated `updateCameraContainment` behind `!engine.draggedNodeId`. The camera now "Locks" relative to the world frame during interaction.

## 3. Verification Steps

### Manual Validation
1.  **Stop Test**: Drag a node fast and release. **Expectation**: Stops instantly (0px slide).
2.  **Hold Test**: Click and hold a node still. **Expectation**: No vibration, rock solid pixels.
3.  **Drift Test**: Drag a simple node far away. **Expectation**: Camera does not pan/zoom to chase you.

## 4. Conclusion
"Hand Authority" is now absolute. The simulation does not fight the user.
