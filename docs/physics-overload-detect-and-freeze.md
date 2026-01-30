# Physics Overload Detection + Freeze (No Syrup)

Date: 2026-01-30

## Scandissect Summary
- Scheduler / rAF: `requestAnimationFrame` loop in `src/playground/useGraphRendering.ts` drives render + physics ticks.
- dt measurement + clamp: `rawDeltaMs = now - lastTime`, clamped by `maxFrameDeltaMs` to `frameDeltaMs`.
- Accumulator / fixed step: `accumulatorMs += frameDeltaMs`, `fixedStepMs = 1000 / targetTickHz`.
- Step loop: `while (accumulatorMs >= fixedStepMs && steps < maxStepsPerFrame)` ticks physics and drains accumulator.
- Dropped time: remainder debt is dropped when `accumulatorMs >= fixedStepMs`, plus any clamp (`rawDeltaMs - frameDeltaMs`).
- Caps: `maxStepsPerFrame`, `maxFrameDeltaMs`, and new `maxPhysicsBudgetMs` guard the loop.
- Drag/input: drag state lives in `PhysicsEngine.draggedNodeId` + `dragTarget`; `GraphPhysicsPlayground` updates drag via mouse events; tick path pins drag in `applyDragVelocity`. Freeze path now pins dragged dot to `dragTarget` without ending drag.

## Overload Triggers + Thresholds
- DT spike: `rawDeltaMs > dtHugeMs` (default `250ms`) => HARD overload + freeze.
- Persistent debt: `accumulatorMs > 2 * fixedStepMs` for `>= 2` frames => overload active (SOFT).
- Budget exceeded: `physicsMs > maxPhysicsBudgetMs` (default `12ms`) => overload active (SOFT).
- Cap hit: `stepsThisFrame == maxStepsPerFrame` AND `accumulatorMs >= fixedStepMs` => overload active (SOFT).
- Watchdog: debt persists for `> 2` frames => HARD overload + freeze + drop debt.
- Hard freeze escalation: if debt is persistent and we also hit budget or cap, queue a hard freeze for the next frame.

## Emergency Failure Mode (One-Frame Freeze)
- When HARD overload triggers (dt spike, watchdog, or queued hard), we:
  - Skip physics ticks for that frame.
  - Drop all debt (`accumulatorMs = 0`).
  - Preserve pointer/drag state and pin dragged dot to cursor.

## Observability (Debug Perf)
Throttled to ~1/sec when `debugPerf` is true:
- `[RenderPerf] fps=.. rafHz=.. dt=.. accumulatorMs=.. steps=.. droppedMs=..`
- `[Overload] active=.. severity=.. reason=.. freezeTriggered=.. freezeCount=.. overloadCount=..`
- `[SlushWatch] debtFrames=.. accumulatorMs=.. avgTickMs=..`

Example logs:
```
[RenderPerf] fps=59.9 rafHz=59.9 dt=16.7 accumulatorMs=2.1 steps=1 droppedMs=0.0
[Overload] active=false severity=NONE reason=NONE freezeTriggered=false freezeCount=0 overloadCount=0
[SlushWatch] debtFrames=0 accumulatorMs=2.1 avgTickMs=0.382

[RenderPerf] fps=32.1 rafHz=32.1 dt=31.2 accumulatorMs=0.0 steps=2 droppedMs=48.0
[Overload] active=true severity=HARD reason=DEBT_PERSIST_BUDGET freezeTriggered=true freezeCount=1 overloadCount=3
[SlushWatch] debtFrames=0 accumulatorMs=0.0 avgTickMs=5.612
```

## Proof: No Syrup
- The watchdog enforces a hard freeze if `accumulatorMs > 2 * fixedStepMs` for more than 2 frames.
- All HARD overloads drop debt (`accumulatorMs = 0`), so backlog cannot persist.
- Cap hit + remaining debt also drops remainder, preventing time dilation.

## Validation Notes
- Debug-only stall: `debugStall` in `ForceConfig` busy-waits ~60ms to trigger overload paths.
- Manual checks to perform:
  1) Normal usage: overload inactive, droppedMs near 0.
  2) Debug stall: observe one-frame hitch + debt drop, no slow motion trail.
  3) Tab switch: dt spike triggers freeze + drop, resume at 1:1.
