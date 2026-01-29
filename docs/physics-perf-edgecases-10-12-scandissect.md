# Physics Perf Edgecases 10-12 Scandissect

## A) rAF Coupling / Tick Rate
- Render loop: `requestAnimationFrame` in `src/playground/useGraphRendering.ts:86-350`.
- Physics ticks are driven by a fixed-step accumulator; target step is `1000 / targetTickHz` (default 60).
- Max steps per frame are capped (`maxStepsPerFrame`) and excess time is dropped.
- On 120/144Hz displays, ticks should stay near `targetTickHz` rather than doubling; rAF frequency only affects render rate.

## B) Scaling Cliffs (N-driven)
- Dominant passes as N grows:
  - Repulsion: O(n^2) (`src/physics/forces.ts:40-140`).
  - Collision: O(n^2) (`src/physics/forces.ts:153-214`).
  - Spacing: O(n^2) (`src/physics/engine/constraints.ts:109-210`).
- Springs are O(E) but can still dominate when E is dense (`src/physics/forces.ts:216-430`).
- Pairwise sampling exists but is static; no dynamic mode or N-based softening yet in this scan (addressed in fixes).

## C) Fatal-Mode Triggers (Big Graphs)
- Entry paths that can feed large N/E:
  - Playground generator: `generateRandomGraph()` -> `engine.addNode/addLink` (`src/playground/useGraphRendering.ts:113-116`).
  - Graph playground loader: `GraphPhysicsPlayground` adds nodes/links from imported data (`src/playground/GraphPhysicsPlayground.tsx:279-282`).
- Engine has no built-in guardrails for large N/E in this scan; big inputs will attempt full simulation and can stall.

## D) Instrumentation (Added)
- `[RenderPerf]` logs now include:
  - `ticksPerSecond`, `avgTickMs`, `p95TickMs`, `maxTickMs`, `ticksPerFrame`, `droppedMs`.
  - Logged once per second when `debugPerf` is enabled.
- `[PhysicsPerf]` already reports pass timings; N/E logging is added in fixes.

## Baseline (Not Captured)
- Ticks per second and tick timing were not measured in this environment.
- Use `debugPerf: true` to collect:
  - `[RenderPerf] ... ticksPerSecond=... avgTickMs=... p95TickMs=... maxTickMs=...`
  - `[PhysicsPerf] ...`
