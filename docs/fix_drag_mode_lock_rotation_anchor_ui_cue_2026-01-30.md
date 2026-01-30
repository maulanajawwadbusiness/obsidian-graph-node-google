# Fix Report: Drag Mode Lock & Rotation Stability
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/playground/useGraphRendering.ts`, `src/playground/components/RotationCompass.tsx`, `src/playground/GraphPhysicsPlayground.tsx`

## 1. Executive Summary
We addressed the "Shifting Sands" effect where simulation rules (Physics Mode or World Anchor) changed while the user was interacting.
*   **Mode Switching**: **LOCKED**. Degrade system cannot change gears during drag.
*   **World Rotation**: **ANCHORED**. Camera rotation pivot is frozen during drag.
*   **Orientation**: **VISIBLE**. Added a compass to communicate world rotation.

## 2. Root Cause Analysis

### A. Drag Mode Switching (Defect 16)
*   **Symptom**: Dragging a node into a dense cluster caused the scheduler to downgrade physics (Normal -> Stressed), effectively changing the friction/stiffness under the user's hand.
*   **Cause**: `setDegradeState` ran unconditionally every frame.
*   **Fix**: Gated `engine.setDegradeState` behind `!engine.draggedNodeId`.
*   **Result**: "Stable Laws". If you start a drag in Normal mode, it stays Normal even if you create a pileup.

### B. World Rotation Drifting (Defect 18)
*   **Symptom**: While dragging, the graph would rotate/shift unexpectedly.
*   **Cause**: `CameraTransform` relied on `engine.getCentroid()`, which changes every frame as the user drags a node (since the dragged node affects the average x/y of the system). A moving pivot + constant Angle = World Shift.
*   **Fix**: Implemented `dragAnchorRef`.
    *   **Start**: Capture `centroid` when `draggedNodeId` appears.
    *   **Drag**: Feed the *captured* centroid to `CameraTransform`.
    *   **End**: Resume live centroid tracking.
*   **Result**: The world "frame" is frozen relative to the screen during interaction.

### C. Invisible Rotation (Defect 17)
*   **Symptom**: User confusion about "Up" vs "North".
*   **Fix**: Added `RotationCompass` component.
    *   Renders a subtle ring in bottom-right.
    *   Needle points to "World North".
    *   Only visible when rotation is non-zero (> 0.05 rad).

## 3. Verification Steps

### Manual Validation
1.  **Stress Drag**: Drag a node wildly to generate load. **Expectation**: Complexity might spike, but physics feel (framerate/substeps) doesn't snap-change mid-drag.
2.  **Pivot Test**: Drag a heavy node far from center. **Expectation**: Background/World does not "swing" around you. The node moves, the world stays put.
3.  **Compass Test**: Wait for global spin/drift. **Expectation**: Compass appears in bottom-right, needle points opposite to rotation.

## 4. Conclusion
Interaction consistency is promoted above simulation "correctness". Use stability > Live updates.
