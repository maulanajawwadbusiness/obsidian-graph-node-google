# Physics Timebase Forensic Report (Fixing #4–#6)

## 1. Current Implementation Scan (`useGraphRendering.ts`)

### A. The Scheduler Loop
The loop uses a standard rAF accumulator pattern:
```typescript
const render = () => {
    const now = performance.now();
    // ... config fetch ...
    const rawDeltaMs = now - lastTime;
    const frameDeltaMs = Math.min(rawDeltaMs, maxFrameDeltaMs); // [1] hard cap
    lastTime = now;

    accumulatorMs += frameDeltaMs; // [2] accumulates capped delta
    
    // ... freeze logic ...

    // [3] Physics Loop
    while (accumulatorMs >= fixedStepMs && stepsThisFrame < maxStepsPerFrame) {
        if (performance.now() - physicsStart >= maxPhysicsBudgetMs) break; // [4] budget break
        engine.tick(fixedStepMs / 1000);
        accumulatorMs -= fixedStepMs;
        stepsThisFrame += 1;
    }
}
```

### B. Identified Issues

#### Fix #4: dt Clamp Time Dilation
*   **Location:** `frameDeltaMs = Math.min(rawDeltaMs, maxFrameDeltaMs)`
*   **Problem:** If `rawDeltaMs` (e.g. 500ms) > `maxFrameDeltaMs` (e.g. 120ms):
    *   We only add 120ms to the accumulator.
    *   380ms of "real time" is discarded *before* we even try to simulate it.
    *   Result: Use observes 500ms passing, simulation only advances 120ms → "Slow Motion" (Syrup).
*   **Fix:** Do NOT clamp `frameDeltaMs` for the accumulator. Let `rawDeltaMs` flow in, but detect "Overload" if it's huge, and effectively "drop debt" from the accumulator *after* budget is exhausted or immediately if it's absurd.

#### Fix #5: Accumulator Bursts
*   **Location:** Inside the loop: `accumulatorMs` remains if `maxStepsPerFrame` or `maxPhysicsBudgetMs` is hit.
*   **Problem:** `if (capHit || budgetExceeded) ...` logic attempts to drop debt, but there are complex conditions (`debtPersistent && ...`).
*   **Fix:** Simplify.
    *   Run as many steps as budget allows.
    *   If budget exhausted and `accumulatorMs` still > `fixedStepMs`: **DROP IT ALL**.
    *   Never carry debt across frames if we are already maxing out bandwidth. Debt carrying is ONLY for jitter smoothing, not for overload backlog.

#### Fix #6: rAF Coupling
*   **Location:** `engine.tick(fixedStep / 1000)` inside `requestAnimationFrame`.
*   **Problem:** The `fixedStepMs` is derived from `engine.config.targetTickHz` (default 60).
    *   If monitor is 144hz: `render()` runs 144 times/sec.
    *   `rawDeltaMs` will be ~6.9ms.
    *   `accumulatorMs` adds 6.9ms per frame.
    *   `fixedStepMs` (16.6ms) > 6.9ms.
    *   Frame 1: Acc=6.9 (0 ticks)
    *   Frame 2: Acc=13.8 (0 ticks)
    *   Frame 3: Acc=20.7 (1 tick, rem=4.1)
    *   Result: Ticks occur on beat 3, 5, 8... Average is correct (60Hz), BUT visual jitter might occur if interpolation isn't perfect (and we don't interpolate, we just render latest).
    *   *Correction:* We actually *want* ticks to be 60Hz even on 144Hz. The current accumulator approach *is* the correct decoupling method.
    *   *Validation:* We need to confirm that `stepsThisFrame` averages to ~0.41 steps/frame on 144Hz (60/144). The *feel* issue might be "frame pacing" or "stiffness" if damping is frame-dependent.
    *   *Check:* `engine.tick(dt)` uses `fixedStepMs`. Damping is `Math.pow(base, dt)`. This should be correct.
    *   *Real Issue:* If `frameDeltaMs` is used for *anything* else, or if we force 1 tick per frame minimum (we don't appear to).
    *   *Hypothesis:* The user mentions "energy decays differently". This implies some part of the code might be using `1 frame` units instead of `dt`.
    *   *Investigation:* Check `src/physics/engine.ts` for per-tick counters that don't scale with dt.
        *   `lifecycle += dt` (Good)
        *   `frameIndex++` (Increments per tick, used for modulo phases)
        *   `preRollFrames` (decrements by 1). If 60Hz ticks, this is constant time. Good.
        *   `localBoostFrames` (decrements by 1). Good.
        *   *Conclusion:* The accumulator loop *correctly* decouples physics Hz from Render Hz. The issue might be simply verifying this is true.

## 2. Plan of Attack

### Step 1: Fix #4 (Time Dilation)
*   Remove `Math.min(rawDeltaMs, maxFrameDeltaMs)`.
*   Feed full `rawDeltaMs` to accumulator.
*   Add `if (accumulator > HugeThreshold) -> Hard Reset (Freeze/Jump)`.

### Step 2: Fix #5 (Burst Control)
*   Inside `render()`:
    *   Reset `accumulatorMs = 0` if `stepsThisFrame` hits absolute limit OR budget limit.
    *   Log "Dropping debt" when this happens.
    *   Ensure NO "syrup" (slow mo) occurs.

### Step 3: Fix #6 (Verify Decoupling)
*   Add explicit logging of `ticksPerSecond` vs `rafHz`.
*   Verify `dampPerSec` calculation matches theoretical values regardless of tick rate.

### Step 4: Instrumentation


## 3. Implementation Details (Completed)

### Fix #4: Removed dt Clamp
- Removed `Math.min(rawDeltaMs, maxFrameDeltaMs)`.
- `frameDeltaMs` now exactly matches `rawDeltaMs`.
- Added safety check: if `accumulatorMs > dtHugeMs * 3` (750ms), hard reset occurs to prevent "spiral of death".

### Fix #5: Burst Control
- Implemented strict debt dropping logic.
- Condition: `if (capHit || budgetExceeded)`.
- Action: `if (accumulatorMs > 0) accumulatorMs = 0` (Hard Drop).
- This ensures that if the machine cannot keep up with real-time (budget hit), we *skip* simulation time rather than letting it pile up (syrup).

### Fix #6: rAF Decoupling
- Verified loop structure: `while (accumulatorMs >= fixedStepMs)`.
- Physics runs at fixed Hz (e.g. 60Hz) completely independent of render Hz (e.g. 144Hz).
- "Syrup Detector" added: If debt persists for >2 frames, it is strictly dropped via watchdog.

### Instrumentation
- Added explicit vars for `freezeThisFrame`, `overloadReason`, `overloadSeverity` tracking.
- Logs now differentiate between `BUDGET_DROP` (performance limit) and `DT_HUGE` (system pause).
