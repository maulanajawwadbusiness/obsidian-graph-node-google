# XPBD Iteration Budget Run 3: Multi-Iteration Loop

## Goal
Implement the actual multi-iteration solver loop with stiffness-aware defaults and convergence guards.

## Changes
1.  **Multi-Iteration Loop**: Wrapped constraint solving in `for (iter=0; iter<iterCount; iter++)`.
2.  **Lambda Reset**: Explicitly zero `lambda` at the start of the *frame* (before loop), allowing lambda accumulation *within* the frame across iterations (though effectively standard XPBD often resets per substep, here we just accumulate corrections). Wait, `lambda` is PBD multiplier. In XPBD, `deltaLambda` updates it. Resetting per frame = "Cold Start". It's standard for stability if not using warm-starting.
3.  **Config Defaults**:
    - `Idle`: 2 iterations (better than 1).
    - `Drag`: 6 iterations (stronger propagation).
4.  **Stagnation Guard**: Checks `iterCorrMax < STAGNATION_THRESHOLD_PX` (0.05px). If true, breaks early to save CPU.
5.  **Telemetry**:
    - `usedIterations`: Actual iterations run (accounting for early break).
    - `earlyBreakCount`: Number of times loop broke early.

## Logic Overview
```typescript
for (k) constraints[k].lambda = 0; // Reset
for (iter < iterCount) {
    solve();
    if (iterCorrMax < 0.05) break; 
}
```

## Verification
- **Idle Behavior**: Should likely hit `earlyBreak` quickly if stable (1 or 2 iters).
- **Drag Behavior**: Should run up to 6 iters if moved fast.
- **HUD**: `iter: Used (cfg: 2/6)`.

## Next Steps
- Run 4: Stability & Safety Caps (Hard caps, world-unit clamps).
