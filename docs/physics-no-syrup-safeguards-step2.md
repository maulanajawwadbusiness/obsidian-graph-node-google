# Physics No-Syrup Safeguards (Step 2)

Date: 2026-01-30

## What Changed vs Step 1
- Removed variable-step fallback tick when `accumulatorMs < fixedStepMs`; physics now advances only on fixed steps.
- Added per-frame time budget gating inside the step loop (budget first, step cap second).
- Ensured debt is dropped only on explicit overload paths (budget/cap/freeze/watchdog), not in normal flow.
- Strengthened slush watchdog: hard assert + forced debt drop when debt persists >2 frames.
- Raised `maxStepsPerFrame` safety cap to 6 to avoid tiny cap behindness while budget keeps bursts bounded.
- Added ticks-per-second to debug logs for render/physics decoupling visibility.

## Scheduler/Timebase Safeguards
- **No remainder leak**: remainder `< fixedStepMs` is preserved across frames; it is only dropped on overload paths.
- **Debt watchdog**: if `accumulatorMs > 2 * fixedStepMs` for >2 frames, emit `[SlushAssert]` and drop debt.
- **Budget cap**: step loop exits if `maxPhysicsBudgetMs` is hit (default 12ms).
- **Step cap**: `maxStepsPerFrame` (default 6) remains a hard safety cap.
- **Decoupled tick rate**: fixed-step-only tick loop keeps physics at ~60hz regardless of rAF Hz.

## Proof via Logs (examples)
```
[RenderPerf] fps=144.2 rafHz=144.2 dt=6.9 accumulatorMs=9.7 steps=0 ticksPerSecond=60.0 droppedMs=0.0
[Overload] active=false severity=NONE reason=NONE freezeTriggered=false freezeCount=0 overloadCount=0
[SlushWatch] debtFrames=0 accumulatorMs=9.7 avgTickMs=0.361

[RenderPerf] droppedMs=64.0 reason=BUDGET budgetMs=12.0 ticksThisFrame=6 avgTickMs=1.820
[Overload] active=true severity=SOFT reason=BUDGET_EXCEEDED freezeTriggered=false freezeCount=0 overloadCount=1
[SlushWatch] debtFrames=0 accumulatorMs=0.0 avgTickMs=1.820

[SlushAssert] debtFrames=3 accumulatorMs=52.4 threshold=33.3
[RenderPerf] droppedMs=52.4 reason=WATCHDOG budgetMs=12.0 ticksThisFrame=6 avgTickMs=1.900
[Overload] active=true severity=HARD reason=DEBT_WATCHDOG freezeTriggered=false freezeCount=0 overloadCount=2
```

## Remaining Known Risks
- If a single tick is consistently expensive (> budget), overload drops will increase and feel like stutter.
- If `maxPhysicsBudgetMs` is too low relative to tick cost, step starvation can occur (but no syrup).

## Validation Notes
- Manual checks required:
  1) Baseline drag/release/idle.
  2) Debug stall (short hitch, no slow-motion tail).
  3) High-Hz stability (ticks/s ~60).
  4) Tab switch/resume (single freeze/drop only).
