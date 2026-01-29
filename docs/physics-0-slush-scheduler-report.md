# Physics 0-Slush Scheduler Report

## 1. Problem Diagnosis
The previous scheduler enforced a hard **Step Count Cap** (`maxStepsPerFrame = 2`) and discarded any remainder time.
- **Slush Vector 1 (Time Dilation)**: If rendering was slow (e.g., 50ms/frame), the accumulator would request 3 ticks, but the cap would force 2. This caused simulated time to run 33% slower than real time, feeling like "slush".
- **Slush Vector 2 (Remainder Leak)**: Every frame, `accumulator % 16ms` was discarded. This leaked average 8ms per frame, acting as a frictional time drag.

## 2. The Solution: "0 Slush" Contract

We implemented a new **Budget-Based Scheduler** that enforces 4 invariants:

### Invariant A: Budget beats Count
Instead of an arbitrary number of steps (2), we now run physics until we hit a **CPU Time Budget** (`maxPhysicsBudgetMs = 12ms`).
- If physics is cheap (1ms/tick), we can run 10 ticks in a single frame to catch up.
- If physics is expensive (10ms/tick), we stop early to prevent death spirals.

### Invariant B: Preserve Remainder
In normal operation (under budget), `accumulator % fixedStep` is preserved for the next frame. Time is never leaked.

### Invariant C: Explicit Debt Forgiveness
If we hit the budget cap or safety cap (12 steps), we **explicitly drop** the remaining accumulator (reset to 0) and log it as `droppedMs`.
- This causes a visual "teleport" (stutter) rather than "slush" (slow motion). The user stays in real-time control.

### Invariant D: Decoupled Rate
Tick rate is purely `targetTickHz` (60) and is mathematically independent of the generic monitor refresh rate.

## 3. Changes Made

### `src/physics/config.ts`
- Added `maxPhysicsBudgetMs`: 12 (default)
- Increased `maxStepsPerFrame`: 12 (safety net only)
- Added `debugSimulateHeavyRender`: false (for validation)

### `src/playground/useGraphRendering.ts`
- Replaced `steps < 2` loop condition with `elapsed < budget`.
- Removed `accumulator = 0` reset in normal path.
- Added `[PhysicsSlushWarn]` logging.

## 4. Validation Plan

### A. Baseline Test
1. Run app.
2. Check `[PhysicsSlushWarn]` logs. Should be silent.
3. Check `[RenderPerf]` logs. `ticks/s` should be ~60. `droppedMs` should be 0.

### B. Heavy Render Test
1. Set `debugSimulateHeavyRender: true` in `config.ts`.
2. App will run at ~20fps (50ms/frame).
3. **Observation**:
   - The graph should still feel "snappy" (0 slush).
   - `ticksPerFrame` in logs should jump to ~3.0 (catching up).
   - `avgTickMs` should remain low (<2ms).
   - If physics becomes expensive too, `[PhysicsSlushWarn]` will fire.

### C. High-HZ Check
1. On 144hz monitors, `ticksPerFrame` should be ~0.4 (running less than once per frame on average), but `accumulator` preserves the partial steps correctly.

## 5. Conclusion
The new scheduler prioritizes **Time Fidelity** over Frame Stability. It ensures the simulation always matches wall-clock time unless the CPU is fundamentally overloaded, eliminating the "underwater" feel caused by render-thread stalls.
