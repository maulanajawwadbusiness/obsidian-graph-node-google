# Idle Stutter / Prefix Rebuild Loop Fix

## Root cause map
- **Measure trigger chain:**
  - `useVirtualBlocks` ran height measurement from the `visibleRange` layout effect (reason: `measure`).
  - The measurement updated `blockHeights` on tiny deltas, which bumped `heightVersion` and rebuilt prefix sums.
  - Prefix rebuilds fed back into layout updates and re-render cycles, so the layout effect kept requesting new measurements even when idle.
- **Idle scheduling sources involved:**
  - Scroll-idle and layout-idle paths can schedule remeasurement.
  - Resize observer scheduling existed, but the repeated idle loops were primarily from the `measure` path when no meaningful height changes existed.

## Guardrails added
- **Measurement settle barrier + dedupe:**
  - Introduced a shared `measureState` ref with `idle/pending/running` states and a `pendingReasons` set.
  - Measurement requests are coalesced; if a pass is pending or running, new triggers are deduped into the set.
- **Batch commit + early exit:**
  - Measurement collects all height changes into a map and commits them in one batch.
  - If the map is empty (no meaningful delta), it exits without rebuilding prefix sums.
- **Epsilon threshold + integer snap:**
  - Tiny deltas under `1px` are ignored.
  - Heights are snapped to integers to avoid fractional ping‑pong.
- **Cooldown + hydration idle gate:**
  - After a measurement commit, the `measure` reason is cooled down for 280ms.
  - While hydrating, measurement waits for 250ms of hydration idle before running.

## Thresholds
- `MEASURE_EPSILON_PX = 1`
- `MEASURE_COOLDOWN_MS = 280`
- `HYDRATION_IDLE_MS = 250`

## How to verify (DV PERF counters)
1. **Idle calm test:**
   - Open a long doc, scroll to the middle, release input.
   - Expect the viewer to remain visually still.
   - `[DV PERF] (idle)` should show `prefixRebuilds=0` after the brief settle window.
2. **Bottom calm test:**
   - Scroll to the bottom, release.
   - Expect the viewer to stay pinned with no bounce.
   - Counters should again show `prefixRebuilds=0` once idle.
3. **Resize/toggle test:**
   - Resize the window (or toggle theme), then stop.
   - Expect a single measure pass and no further rebuilds while idle.
4. **Hydration test:**
   - Open a doc and let hydration run.
   - Expect at most one measure after hydration quiets, then idle calm.
