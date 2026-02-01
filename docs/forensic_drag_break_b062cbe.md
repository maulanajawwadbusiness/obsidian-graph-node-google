# Forensic: Drag Regression Introduced by `b062cbe`

## Background
- `b062cbe` (“xpbd: iteration safety caps + convergence telemetry”) rewires `solveXPBDEdgeConstraints` to respect idle/drag iteration budgets, add telemetry (maxAbsC/iter counts), and clamp the loop to a hard cap.
- The fix works from a solver perspective, but a reference cleanup missed a crucial variable that the solver loop still reads in every iteration.

## Symptom
- Every physics tick invokes `solveXPBDEdgeConstraints`. With the missing definition, the very first pass hits the line `prevIterCorrMax = iterCorrMax;` (`src/physics/engine/engineTickXPBD.ts:416`) with no prior declaration.
- When running the app and dragging a dot (or even just letting physics update for the first time), the bundle throws `ReferenceError: prevIterCorrMax is not defined` (mirrored in the browser console or devtools).
- The exception halts the physics loop, so `grabNode`/`moveDrag`/`releaseNode` never complete. As soon as a drag is attempted, the canvas stops responding — nodes cannot be moved.

## Root Cause
- Prior to `b062cbe`, `solveXPBDEdgeConstraints` declared the rewrite guard:
  ```ts
  let prevIterCorrMax = Number.MAX_VALUE;
  let stagnationStreak = 0;
  ```
  The solver used `prevIterCorrMax` later (line 416) to detect divergence/stagnation. This declaration lived alongside the multi-iteration setup.
- The new iteration safety changes removed those `let` declarations while keeping the assignment at the end of the loop. TypeScript/JavaScript now attempts to write to an undeclared identifier every tick.
- Because `prevIterCorrMax` never exists, the assignment throws immediately, and the entire XPBD tick (and upstream `runPhysicsTickXPBD`) aborts, killing drag and all solver progress.

## Impact
- Dragging is deterministic in the engine because a grabbed dot becomes `isFixed` and forces the solver to run extra iterations. That’s exactly when `solveXPBDEdgeConstraints` runs more than once, so the crash is triggered as soon as drag starts.
- With the physics loop dead, nothing responds to input. The UI appears frozen whenever `useXPBD` is enabled (default), so the regression is severe.
- The telemetry additions (maxAbsC, max iterations, etc.) never populate because we never make it past the crash.

## Next Steps
1. Restore a declaration for `prevIterCorrMax` (and `stagnationStreak` if the convergence guard is still desired) before entering the loop.
2. Re-run the drag flow to confirm `ReferenceError` disappears and telemetry logs fill again.
3. Optionally add a unit or smoke test that ensures `runPhysicsTickXPBD` can complete without throwing when XPBD is active.

This report captures the regression without taking any mitigation action. Let me know if you want a follow-up fix or test coverage.
