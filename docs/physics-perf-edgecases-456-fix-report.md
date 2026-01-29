# Physics Perf Edgecases 4-6 Fix Report

## Changes Applied
- Smoothed spacing gate with a stateful ramp so the spacing pass fades in instead of turning on abruptly.
- Added a spacing activation floor to avoid running the full pass until the gate has meaningfully ramped.
- Switched render loop to a capped fixed-step accumulator (max 2 steps per frame) and drop remainder time if behind.
- Reworked dt handling to clamp per-frame delta and track dropped time.
- Extended render-loop perf logging to report ticks per frame and dropped time.

## Code References
- Spacing gate smoothing and activation floor:
  - `src/physics/engine.ts:279-378`
  - `src/physics/engine/constraints.ts:87-176`
- Fixed-step accumulator with max steps and dropped time:
  - `src/playground/useGraphRendering.ts:95-168`

## Before/After Timing
- Not captured in this environment (no live render loop).
- Use `debugPerf: true` and compare:
  - `[PhysicsPerf]` for per-pass timings.
  - `[RenderPerf]` for avg/max tick ms, ticks per frame, and dropped ms.

## Before/After Ticks-Per-Frame
- Before: 1 tick per render frame (no accumulator).
- After: 1-2 ticks per frame, hard capped; excess time is dropped (logged as `droppedMs`).

## Edgecase Outcomes
- Startup turbo cliff: spacing cost ramps in via gate smoothing and remains light until the gate rises.
- Time dilation after hitch: large deltas are clamped and not endlessly replayed; the sim resumes normal pacing without long slow motion.
- Multi-step loop spikes: accumulator has a strict max-steps cap; remainder time is dropped and counted.

## Tradeoffs
- Dropping accumulated time can make the sim slightly less "accurate" after long stalls, but avoids CPU spikes and syrupy pacing.
- Spacing corrections arrive slightly later during gate ramp, but motion remains buoyant.
