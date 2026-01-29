# Physics Perf Edgecases 7-9 Fix Report

## Changes Applied
- Removed per-tick Map->Array conversions by caching the node list and reusing it in `tick()`, `getCentroid()`, and the render loop.
- Reused correction accumulator maps instead of rebuilding per tick; only new nodes allocate fresh entries.
- Made sleep meaningful: dots that stay under the velocity threshold for multiple frames become `isSleeping` and are skipped in sleeping-sleeping pair interactions.
- Added topology caps and dedupe in `addLink()` to prevent edge explosion and multi-edges.
- Extended perf logs with N/E counts, allocation suspects, and topology drop/dup stats.

## Code References
- Node list cache + awake/sleeping lists: `src/physics/engine.ts:52-130`, `src/physics/engine.ts:246-320`, `src/physics/engine.ts:430-470`.
- Correction accumulator reuse: `src/physics/engine/constraints.ts:4-20`, `src/physics/engine.ts:430-438`.
- Sleep semantics in integration: `src/physics/engine/integration.ts:173-188`.
- Pair passes skip sleeping-sleeping: `src/physics/forces.ts:8-137`, `src/physics/engine/constraints.ts:87-188`, `src/physics/engine/constraints.ts:264-354`.
- Link caps + dedupe: `src/physics/engine.ts:90-122`.
- Render loop node list reuse: `src/playground/useGraphRendering.ts:235-236`.

## Before/After Timing
- Not captured in this environment (no live render loop).
- Use `debugPerf: true` to compare:
  - `[PhysicsPerf] ... nodes=... links=... allocs=... topoDrop=... topoDup=...`
  - `[RenderPerf] avgTickMs=... maxTickMs=...`

## Before/After N/E Behavior
- Before: links could grow without cap or dedupe; springs O(E) could become O(n^2).
- After: `maxLinksPerNode` and `maxTotalLinks` prevent dense topology; duplicate edges are skipped.

## Tradeoffs
- Sleeping dots no longer repel each other; if both are at rest, their mutual interactions are skipped until a nearby awake dot perturbs them.
- Link caps can drop edges from overly dense inputs; warns once per second with `[PhysicsTopology]` logs.

## Notes
- Allocation suspects reported in `allocs` are node list rebuilds and new correction entries (should trend toward 0 during steady state).
