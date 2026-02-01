# Forensic Catch-Up: DT & XPBD Compliance Alignment (Knife-Grade)
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** PROVEN & BINDING

## 1. DT Provenance Proof (End-to-End)
We certify that `dt` is strictly **Seconds**, delivered via a **Fixed-Step Accumulator** loop.

### A. The Scheduler (Origin)
**File:** `src/playground/rendering/renderLoopScheduler.ts`
The scheduler manages the `accumulatorMs` bucket.

1.  **Input Delta:**
    ```typescript
    // Line 48
    let rawDeltaMs = now - schedulerState.lastTime;
    ```
2.  **Accumulation:**
    ```typescript
    // Line 64
    schedulerState.accumulatorMs += frameDeltaMs;
    ```
3.  **The Accumulator Loop (Fixed Step):**
    ```typescript
    // Line 117: Loop conditions
    while (schedulerState.accumulatorMs >= fixedStepMs && stepsThisFrame < maxSteps) {
        
        // Line 129: THE CALLSITE
        // fixedStepMs is typically 16.666ms (1000/60).
        // Division by 1000 guarantees SECONDS.
        engine.tick(fixedStepMs / 1000); 

        // Line 131: Debit accumulator
        schedulerState.accumulatorMs -= fixedStepMs;
    }
    ```

**Verdict:** The physics engine receives a constant `dt` (e.g. `0.016666`), possibly multiple times per render frame (Catch-Up), or zero times (if budget exceeded).

### B. The Engine (Consumption)
**File:** `src/physics/engine/engineTick.ts`
1.  **Entry:**
    ```typescript
    // Line 41
    export const runPhysicsTick = (engine: PhysicsEngineTickContext, dtIn: number) => {
    // dtIn is exactly (fixedStepMs / 1000) from the scheduler.
    ```
2.  **Policy Check (Redundant but Safe):**
    ```typescript
    // Line 50
    const policyResult = engine.timePolicy.evaluate(dtIn * 1000);
    // Line 51
    const dt = policyResult.dtUseSec; 
    // Since dtIn is fixed (16ms), the policy simply passes it through 
    // unless it violates safety clamps (maxFrameDeltaMs).
    ```

## 2. Reconciling "Single-Step" Wording
*   **Engine Perspective:** `engineTick.ts` runs a **Single Integration** step per call. It does *not* loop internally (no `numSubsteps` loop).
*   **System Perspective:** The `renderLoopScheduler` performs **Multiple Steps** (Catch-Up) if the render thread lags.
*   **Implication for XPBD:**
    *   XPBD constraints run **Once Per Tick**.
    *   If the scheduler runs 3 ticks to catch up, XPBD runs 3 times.
    *   **Ghost Velocity Risk:** Highly reduced because `engineTick` finishes a full position/velocity update cycle *before* the next tick starts.

## 3. Legacy K -> XPBD Compliance (Concrete Math)
We discard the vague "alpha = 1/k" claim. We define compliance $\alpha$ using the canonical XPBD update equation for a distance constraint.

**Equations:**
1.  $\alpha_{tilde} = \alpha / dt^2$
2.  $\Delta \lambda = \frac{-C - \alpha_{tilde} \lambda}{w_{sum} + \alpha_{tilde}}$
3.  $\Delta x = w_i \cdot \Delta \lambda$

**Constants:**
*   `dt`: 0.01666s (60Hz) -> $dt^2 \approx 0.000277$
*   `mass`: 1.0 (Fiber/Default) -> $w = 1.0$
*   `w_sum`: $1+1=2$
*   `Error (C)`: 10px (Gap)
*   `Warm Start`: $\lambda = 0$ (Cold)

**Mapping Table:**

| Desired Feel | Compliance ($\alpha$) | $\alpha_{tilde}$ | Correction Formula | Total Gap Closed (10px) | Remaining Error |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rigid (Contact)** | **0.00000** | 0 | $-10 / 2$ = -5 | $5+5 = 10.0$px | **0.0px (Snap)** |
| **Stiff (Rope)** | **0.00001** | 0.036 | $-10 / 2.036$ = -4.91 | $4.91+4.91 = 9.82$px | **0.18px** |
| **Firm (Rubber)** | **0.00100** | 3.61 | $-10 / 5.61$ = -1.78 | $1.78+1.78 = 3.56$px | **6.44px** |
| **Soft (Elastic)** | **0.00500** | 18.05 | $-10 / 20.05$ = -0.49 | $0.49+0.49 = 0.98$px | **9.02px** |
| **Legacy K=0.2** | ~0.0005 | ~1.8 | - | - | Matches "Firm" |

**Recommendation:**
*   **Contact/Repulsion:** Use $\alpha = 0.0$ (Hard).
*   **Links:** Start with $\alpha = 0.00001$ for "Knife-Sharp" lines.

## 4. XPBD Integration Contract
The exact execution order required to guarantee `vx/vy` consistency and ghost velocity avoidance.

```typescript
// XPBD Integration Contract
// --------------------------------------------------------

// 1. Prediction Phase (Owns X/Y temp)
//    x_pred = x + v * dt;
//    No force application here (forces applied to v BEFORE this).

// 2. Neighbor Search (Broadphase)
//    Update spatial hash using x_pred.

// 3. XPBD Solver Loop (Owns X/Y/Lambda)
//    for (i = 0; i < iterations; i++) {
//        solveConstraints(x_pred, dt); // Modifies x_pred directly
//    }

// 4. Velocity Rebuild (Owns VX/VY)
//    v_new = (x_pred - x_prev) / dt;
//    // Essential: This overwrites any "force-accumulated" velocity 
//    // with the "constraint-compliant" velocity.

// 5. Finalize (Commit)
//    x = x_pred;
//    // x, y, vx, vy are now consistent for the next tick.
```

**Ownership:**
*   **Predict -> Solve:** Owns temporary `x`, `y` (candidates).
*   **Rebuild:** Reclaims `vx`, `vy` from the positional change.
*   **Finalize:** Commits `x`, `y` to the `PhysicsNode`.
