# Forensic Report: DT & XPBD Compliance Alignment
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** ALIGNED

## 1. DT Source & Units
**Tracing the Time Delta:**
1.  **Input:** `engineTick.ts:41` `runPhysicsTick(..., dtIn)`. `dtIn` is typically seconds (from `requestAnimationFrame` delta).
2.  **Policy:** `dtPolicy.ts` evaluates `dtIn * 1000` (ms).
    -   Clamps to `maxDtMs` (50ms).
    -   Outputs `policyResult.dtUseSec` (Seconds).
3.  **Consumption:** `engineTick.ts:51`.
    -   `const dt = policyResult.dtUseSec`. **This is the SINGLE TRUTH.**
    -   Passed to `integrateNodes` (L641).
    -   Passed to `applyForcePass` (L609).
4.  **Consistency:**
    -   `applyDamping`: uses `nodeDt` (which is `dt`). Correct.
    -   `applyDragVelocity`: uses `dt`. Correct.
    -   **Verdict:** The engine uses a consistent, clamped `dt` in Seconds.

## 2. XPBD Math Alignment
To integrate XPBD into this `dt` flow, we must match the units.

**The Update Equation:**
```typescript
// XPBD Position Update
// C(x) = dist - restLen
// alpha = compliance / (dt * dt)
// deltaLambda = (-C - alpha * lambda) / (wSum + alpha)
// deltaPos = w * deltaLambda * n
```

**Compliance Units (Stiffness -> Alpha):**
-   Legacy Config: `springStiffness` = 0.2.
-   Is this Force-based stiffness (`k`) or compliant? 
-   Legacy used `force = k * disp`.
-   XPBD Compliance (`alpha`) is inverse stiffness. `alpha = 1 / k`.
-   **Scaling:**
    -   If we want "Infinite Stiffness" (Hard Contact): `alpha = 0`.
    -   If we want "Soft Spring" (0.2): `alpha = 1 / 0.2 = 5.0`?
    -   **Wait:** XPBD `alpha` must be scaled by `dt^2` in the denominator.
    -   Formula: `wSum + alpha / (dt * dt)`.
    -   Let's define `compliance` (material property) independent of `dt`.
    -   `alpha` (runtime) = `compliance`.
    -   **Solver config:**
        -   `Hard Contact`: `compliance = 0`.
        -   `Link`: `compliance = userStiffnessInverse`.

**Handling DT Spikes (Quarantine):**
-   If `dt` spikes (e.g. 50ms clamp hit), `dt^2` becomes large.
-   `deltaLambda` denominator `alpha / dt^2` becomes small.
-   Effect: Constraint becomes **stiffer** as `dt` increases (if alpha is constant).
    -   This is correct XPBD behavior (fixed compliance).
-   **Risk:** `dt` too large -> Over-projection?
    -   XPBD is unconditionally stable? Yes, implicit.
    -   But visual jitter may occur.
-   **Policy:** The `dtPolicy` clamp at 50ms ensures `dt` never goes wild.
    -   Max `dt` = 0.05. `dt^2` = 0.0025.
    -   Denominator `w + alpha/0.0025`.
    -   Safe.

## 3. Integration Plan Verification
**1. Substepping:**
   -   Legacy uses `maxStepsPerFrame: 6`.
   -   We should run XPBD solver inside substeps?
   -   **Decision:** Start with **Single Step** (match Legacy Budget). XPBD is stable.
   -   If jitter > 0.5px (from `forensic_native_ledger.md`), enable substepping.

**2. Velocity Update (Vel = (x - x0) / dt):**
   -   XPBD updates `x`.
   -   We must update `v` at end of tick: `v = (x - prevX) / dt`.
   -   **Critical:** This `dt` MUST match the integration `dt`.
   -   **Check:** `integrateNodes` updates `x += v * dt`. `prevX` tracks `x` before integration.
   -   XPBD modifies `x`.
   -   Final `v` calculation typically done *before* next integration or *after* constraint solve.
   -   Legacy engine updates `prevX` manually in constraints?
   -   **New Flow:**
        1.  `integrateNodes`: `xPred = x + v * dt`.
        2.  `solveXPBD`: modifies `xPred`.
        3.  `updateVelocity`: `v = (xPred - x) / dt`.
        4.  `x = xPred`.
   -   **Correction:** Legacy `integrateNodes` writes to `x` immediately (Euler).
   -   XPBD fits:
        1.  Predict: `x' = x + v * dt`. (Done by `integrateNodes`)
        2.  Solve: `x'' = solve(x')`. (Done by new constraints)
        3.  Update V: `v = (x'' - x) / dt`. (Finalize step)
        4.  Update X: `x = x''`.
   -   **NOTE:** We must store `x_old` before integration to compute `v` accurately.

## 4. Final Alignment Checklist
-   [x] **DT Units:** Seconds (`dtUseSec`).
-   [x] **Damping:** Applied in `integrateNodes` using `dt`.
-   [x] **Constraint Math:** Standard XPBD.
-   [x] **Velocity Rebuild:** Explicit step required `v = (x - x_old) / dt`.
-   [x] **Spike Safety:** `dt` clamped to 50ms prevents denominator explosion.

**Warning:**
The current `integrateNodes` updates `node.x` in place.
We need to capture `x_old` **before** `integrateNodes` runs if we want true symplectic Euler / XPBD velocity update.
*Current engine:* `prevX` seems used for history, but maybe not rigorously for Verlet/XPBD.
*Action:* Ensure `finalizePhysicsTick` or post-solver step updates `v` correctly using the actual effective `dt`.
