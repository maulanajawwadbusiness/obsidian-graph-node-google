# Physics Stiffness Time-Consistency Report

## 1. Problem Diagnosis
Previously, many physics parameters were applied **per-tick** (constant value), assuming a fixed 60Hz rate.
When the tick rate dropped (e.g., to 30Hz due to lag or throttling) or changed (variable steps), the effective physical forces per second would change.
- **Damping**: Applied as `v *= 0.9` per tick. At 30Hz, this happened half as often, resulting in `0.9^30` decay per second instead of `0.9^60`. Friction effectively disappeared at low frame rates.
- **Constraints**: Corrections were capped at `maxCorrectionPerFrame = 1.5` pixels per tick. At 30Hz, the system could only correct 45px/sec instead of 90px/sec, making connections feel "rubbery".
- **Resistance**: Angle and Expansion resistance applied fixed velocity penalties per tick.

## 2. The Solution: DT-Normalization
We normalized all stiffness-related parameters to a **60Hz Baseline**.
- **Time Scale Factor**: `timeScale = dt * 60.0`.
- **Budgets**: `budget = budgetBase * timeScale`.
- **Damping**: `decay = Math.exp(-k * dt)` or `Math.pow(base, timeScale)`.

## 3. Changes Implemented

### A. Damping (Exponential Decay)
- **Before**: `vx *= (1 - damping * dt * 5)` (Linear approximation)
- **After**: `vx *= Math.exp(-damping * 5.0 * dt)` (True exponential decay)
- **Result**: Friction is mathematically identical regardless of step size `dt`.

### B. Constraints (Time-Scaled Budgets)
Files: `constraints.ts`, `corrections.ts`
- **Edge Relaxation**: `relaxStrength` scaled by `dt * 60`.
- **Spacing**: `softMaxCorrectionPx` and `maxCorrectionPerFrame` scaled by `dt * 60`.
- **Safety Clamp**: `emergencyCorrection` scaled by `dt * 60`.
- **Correction Budget**: `maxNodeCorrectionPerFrame` scaled by `dt * 60`.
- **Result**: The "stiffness" (maximum restoring speed in px/sec) remains constant.

### C. Velocity Resistance (Time-Scaled Forces)
Files: `angleResistance.ts`, `distanceBias.ts`, `expansionResistance.ts`
- **Angle Force**: Scaled force magnitude by `dt * 60`.
- **Distance Bias**: Scaled bias strength by `dt * 60`.
- **Expansion Damping**: Converted linear damp `1 - k` to `Math.pow(1 - k, dt * 60)`.
- **Result**: Geometric constraints hold their shape equally well at 30Hz as 60Hz.

## 4. Verification

### Instrumentation
Added `[PhysicsFeel]` logs to `engine.ts`:
```
[PhysicsFeel] mode=normal dt=16.7ms dampPerSec=0.049 corrBudgetPerSec=90.0px spacingGate=0.000
```
- **dampPerSec**: Represents the fraction of velocity remaining after 1 second. Should be stable across `dt`.
- **corrBudgetPerSec**: Represents max pixel correction capability per second. Should be ~90px.

### Validation Steps (Manual)
1. **Baseline**: Run at 60Hz. Observe `[PhysicsFeel]` values.
2. **Stress Calculation**:
   - IF `targetTickHz` drops to 30.
   - `dt` becomes ~32ms.
   - `timeScale` becomes ~2.0.
   - `budget` per tick doubles (3.0px).
   - `budgetPerSec` remains `3.0 * 30 = 90.0px`. **Consistent.**

## 5. Conclusion
The physics engine is now **Time-Consistent**. Changes in frame rate or tick rate (throttling) will no longer alter the fundamental stiffness and friction of the graph, eliminating the "slushy" feel in stressed scenarios.
