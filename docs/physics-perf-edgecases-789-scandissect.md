# Physics Perf Edgecases 7-9 Scandissect

## A) Per-Tick Allocations (GC Risk)
Primary per-frame conversions:
- `Array.from(this.nodes.values())` in `PhysicsEngine.getCentroid()` (`src/physics/engine.ts:141-147`).
- `Array.from(this.nodes.values())` in `PhysicsEngine.tick()` (`src/physics/engine.ts:248-250`).
- `Array.from(engine.nodes.values())` in render loop for camera containment (`src/playground/useGraphRendering.ts:235-236`).

Per-tick Map/Set/array creation in hot passes:
- Correction accumulator is rebuilt every tick (`initializeCorrectionAccum` in `src/physics/engine/constraints.ts:4-12`).
- Spacing creates a new `Set` for affected nodes per tick (`src/physics/engine/constraints.ts:28-33`).
- Triangle area constraints allocate `Set`, `triangles[]`, and `nodeIds[]` every tick (`src/physics/engine/constraints.ts:205-228`).
- Corrections pass allocates `nodeDegree` + `nodeNeighbors` maps, `diffusedCorrection` map, `affected` set, and per-node `{x,y}` objects (`src/physics/engine/corrections.ts:17-40`, `src/physics/engine/corrections.ts:64-66`).
- Pre-roll force pass builds `neighborMap` each tick (`src/physics/engine/forcePass.ts:91-99`).

Hidden per-pair temporaries:
- New direction objects in corrections: `const newDir = { x, y }` per node (`src/physics/engine/corrections.ts:64-66`).
- Triangles pass builds `[idA,idB,idC]` tuples for every triangle (`src/physics/engine/constraints.ts:215-228`).

Storage model:
- Nodes stored in `Map<string, PhysicsNode>` and links in `PhysicsLink[]` (`src/physics/engine.ts:34-35`).
- Most hot passes operate on arrays, forcing conversions from Map -> Array each tick.

## B) Sleep Threshold Logic (CPU Trap)
- Sleep is applied in integration by zeroing `vx/vy` when below threshold (`src/physics/engine/integration.ts:173-180`).
- There is no `isSleeping` or awake set; sleeping does not remove dots from:
  - Repulsion loops (`src/physics/forces.ts:42-124`).
  - Collision loops (`src/physics/forces.ts:149-193`).
  - Spacing loops (`src/physics/engine/constraints.ts:118-196`).
  - Correction diffusion (`src/physics/engine/corrections.ts:41-116`).
- Net effect: sleep is a visual stabilizer only and does **not** reduce O(n^2) work.

## C) Topology Density Risk (Springs -> O(E))
- Springs iterate `engine.links` directly (`src/physics/forces.ts:222-450`), so cost is O(E).
- `PhysicsEngine.addLink()` currently pushes blindly, no dedupe or cap (`src/physics/engine.ts:95-103`).
- Graph generation uses `generateRandomGraph()` with `links.forEach(engine.addLink)` (`src/playground/useGraphRendering.ts:113-116`).
- There is no validation for complete-graph or multi-edge inputs; if upstream supplies dense edges, springs becomes effectively O(n^2).

## D) Instrumentation (Added)
- Existing `[PhysicsPerf]` logging includes per-pass timings (`src/physics/engine.ts:356-384`).
- Render-loop perf logging for ticks-per-frame exists (`src/playground/useGraphRendering.ts:166-187`).
- **Missing**: allocations count, N/E reporting, and dense-topology warning (to be added in fixes).

## Baseline (Not Captured)
- Timing baselines and N/E metrics not recorded in this environment.
- Use `debugPerf: true` to capture `[PhysicsPerf]` + `[RenderPerf]` once new metrics are added.
