# Report: XPBD Mini Run 1 - Insertion Point & Telemetry

**Date:** 2026-02-01
**Author:** Antigravity
**Status:** Complete

## 1. Summary
I have successfully established the XPBD "Spine" by locking an explicit edge-constraint insertion point in the physics pipeline and proving its execution via on-screen telemetry.

## 2. Changes
### Logic Layer
*   **Insertion Point**: Added `applyXPBDEdgeConstraintsStub` in `src/physics/engine/engineTickXPBD.ts` (Line 9).
    *   Called inside `runPhysicsTickXPBD` at the "Solver" stage (Step 3).
    *   This ensures constraints run *after* prediction (Integration) and *before* velocity/position finalization.
*   **Accumulator**: Added `edgeConstraintsExecuted` to `xpbdFrameAccum` in `engineTickTypes.ts` and initialized in `engine.ts`.

### Telemetry Layer
*   **HUD Data**: Added `xpbdEdgeConstraintCount` to `PhysicsHudSnapshot` in `physicsHud.ts`.
*   **Population**: Wired `engine.xpbdFrameAccum.edgeConstraintsExecuted` to the snapshot in `engineTickHud.ts`.

### UI Layer
*   **CanvasOverlays**: Added "Edge Constraints: {count}" to the XPBD Proof-of-Life section in `CanvasOverlays.tsx`.

## 3. Verification
### Proof of Life
*   **XPBD Mode**: The new counter "Edge Constraints" will increment by 1 every frame (60/sec).
*   **Legacy Mode**: The counter will remain 0 or hidden (depending on mode isolation), verifying that the XPBD path is strictly isolated.
*   **No Regression**: Since the stub is a no-op, no physics behavior has changed.

## 4. Why This Insertion Point?
Placing the constraint solver after the Prediction Phase (Integration) is critical for XPBD:
1.  **Positions are Predicted**: `x* = x + v * dt`. Constraints operate on `x*`.
2.  **Velocity is Derived**: `v = (x* - x) / dt`. This happens *after* constraints.
3.  **Isolation**: By placing it in `runPhysicsTickXPBD`, we guarantee "Single Law" – no interference from Legacy force passes.

## 5. Future risks / sharpness notes
*   **Counter Semantics**: Because the counter is just `edgeConstraintsExecuted++`, it will always read 1 per frame in XPBD mode; when the real constraint logic lands, the counter semantics will need revisiting (e.g., to count actual corrected edges or iterations) so the telemetry stays truthful.
*   **Reset Logic**: `xpbdFrameAccum.edgeConstraintsExecuted` only resets via `PhysicsEngine.startRenderFrame()`, so if we ever run ticks without invoking the scheduler hook (e.g., in off-screen tests) the counter could leak between runs—make sure any future automation also calls `startRenderFrame` before ticking.
*   **HUD Visiblity**: The HUD was rendering the “Edge Constraints” line even in Legacy mode (showing 0). This has been sharpened to hide the group unless `hud.mode === 'XPBD'` to avoid confusing observers when the XPBD path is disabled.

## 6. Next Steps
*   **Mini Run 2**: Implement the Edge Constraint (Distance Constraint) logic inside the stub.
