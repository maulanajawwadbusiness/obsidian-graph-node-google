# Propagation Proof Telemetry Run 3: Convergence

## Goal
Visualize the iterative convergence of the XPBD solver to prove that multi-iteration frames are actually improving the solution (reducing error).

## Changes
1.  **EngineTickXPBD**:
    - Added `maxAbsCFirst` to track maximum constraint error in the *first* iteration (iter=0).
    - Capture logic added to main loop and early break check.
    - Initialized in `runPhysicsTickXPBD`.
2.  **Telemetry**:
    - Exposed `propMaxAbsCFirst` to HUD.
3.  **CanvasOverlays**:
    - Added "CONVERGING" badge (Cyan).
    - Condition: `MaxC < MaxCFirst * 0.95` AND `Iterations > 1`.

## Verification
- **Code Logic**: Confirmed `iter=0` capture and `engine.xpbdFrameAccum` storage via PowerShell patch.
- **HUD**: Badge should appear when the solver effectively reduces error across multiple passes (typical during high-stress drag).

## Next Steps
- Run 4: Movement Wave (Hop Counts).
