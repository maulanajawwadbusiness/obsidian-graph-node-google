# XPBD Iteration Budget Run 4: Stability & Cost Control

## Goal
Enforce safety limits on the multi-iteration loop to prevent performance regressions or instability.

## Changes
1.  **Hard Cap**: `MAX_ITERATIONS_HARD_CAP = 12`.
    - Logic: `safeIterCount = Math.min(iterCount, MAX_ITERATIONS_HARD_CAP)`.
    - Prevents configuration errors (e.g. Setting Drag=100) from freezing the main thread.
2.  **Telemetry**:
    - `maxAbsC`: Tracks the maximum constraint violation (error distance) in the *final* iteration.
    - `earlyBreakCount`: Exposed in HUD.
3.  **HUD Update**:
    - `iter: Used (cfg: Idle/Drag) | maxC: N.NNpx`
    - `solve: N.NN ms (Break: N)`

## Verification
- **Safety**: Verified `safeIterCount` logic clamps `iterCount`.
- **Telemetry**: `maxAbsC` shows convergence quality (smaller is better).
- **Ghost Reconciliation**: Confirmed correct because `preSolveSnapshot` is taken *before* the loop, and `reconcile` runs *after* the loop using the final `node.x`. The delta `dx = current - preSolve` correctly encompasses the cumulative effect of all iterations.

## Next Steps
- Run 5: Hand Acceptance Tests & Tuning.
