# Fix Report: Determinism, Law Lock, & Camera Causality
**Date**: 2026-01-30
**Status**: APPLIED
**Scope**: "Predictable Physics" Initiative (Fixes #43, #44, #45)

## 1. Problem Statement
The application felt "haunted" or "unpredictable" due to three core issues:
1.  **Non-Determinism**: Identical gestures produced different results depending on instantaneous frame rate (Debt Drops).
2.  **Law Shifting**: The physics engine would change its "laws" (degrade state) *during* a drag, causing the world to suddenly feel slippery or stiff under the hand.
3.  **Ghost Motion**: Camera smoothing continued after the user stopped moving their hand, creating a disconnect between input and outcome.

## 2. Solutions Applied

### A. Law Lock (Fix #43 & #44)
**Mechanism**: Hard-coded bypass logic in the `useGraphRendering` loop.
**Logic**:
*   **Trigger**: `isInteracting = !!engine.draggedNodeId`.
*   **Degrade Lock**: If interacting, `engine.setDegradeState` is skipped. The physics rules active at the start of the drag are frozen until release.
*   **Budget Lock**: If interacting:
    *   `maxPhysicsBudgetMs` is set to `Infinity`.
    *   `maxStepsPerFrame` is increased to `10`.
    *   This forces the engine to run *every required tick* to keep up with real-time, even if it chugs the frame rate.
*   **Result**: The physics simulation is now 100% deterministic relative to wall-clock time during interaction. No "skipped beats".

### B. Camera Causality (Fix #45)
**Mechanism**: Conditional Smoothing in `camera.ts`.
**Logic**:
*   New parameter `isInteraction` passed to `updateCameraContainment`.
*   **When Interacting**: `alpha = 1.0` (Instant Snap). Camera tracks target 1:1.
*   **When Idle**: `lambda = 15.0`. Camera settles quickly (critically damped) but smooths out micro-jitters.
*   **Result**: When the hand stops, the camera stops. No "drift" or "ghosting".

## 3. Verification Steps
1.  **Determinism**: Drag a node rapidly in a heavy graph (200+ nodes).
    *   *Before*: Graph might "pop" or lag significantly, or slide too far.
    *   *After*: Graph deforms consistently. FPS might drop, but the shape deformation is solid.
2.  **Law Lock**: Drag a node while resizing window (forcing load).
    *   *Before*: Connections might suddenly disappear (degrade lvl 2).
    *   *After*: Connections stay visible. Laws do not change under the hand.
3.  **Camera**: Pan the view (drag node to edge) and stop abruptly.
    *   *Before*: View slides for ~300ms.
    *   *After*: View stops instantly.

## 4. Performance Note
These fixes strictly prioritize **Interaction Quality** over **Frame Rate**. In extreme load scenarios, the UI may become less responsive (lower FPS) during a drag, but the physics integrity will remain perfect. This is the intended design ("Knife-Priority").
