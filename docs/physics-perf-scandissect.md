# Physics Perf Scandissect (Step 1)

## Pipeline Map (Per Tick)
- Entry point: `engine.tick(dt)` invoked by RAF loop in `src/playground/useGraphRendering.ts:117` and implemented in `src/physics/engine.ts:239`.
- Phase order (from `src/physics/engine.ts:255-351`):
  1) Pre-roll (soft start): `runPreRollPhase` (pre-roll frames) then impulse at `lifecycle < 0.1`.
  2) Escape window advance: `advanceEscapeWindow`.
  3) Energy envelope: `computeEnergyEnvelope` computes `energy`, `forceScale`, damping (`src/physics/engine/energy.ts:8-36`).
  4) Force pass: `applyForcePass` -> repulsion, collision, springs, boundary (`src/physics/engine/forcePass.ts:160-185`).
  5) Drag + pre-roll velocity: `applyDragVelocity`, `applyPreRollVelocity` (`src/physics/engine.ts:294-295`).
  6) Integration: `integrateNodes` (`src/physics/engine.ts:297-298`).
  7) Degree calc: `computeNodeDegrees` for constraint exclusions (`src/physics/engine.ts:300-304`).
  8) Velocity de-locking passes (order): expansion resistance, dense-core unlock, static friction bypass, angular decoherence, local phase diffusion, edge shear escape, dense-core inertia relaxation (`src/physics/engine.ts:306-324`).
  9) PBD correction block: edge relaxation -> spacing -> triangle area -> angle resistance -> distance bias -> safety clamp -> correction diffusion (`src/physics/engine.ts:331-347`).

## Hot Passes (N^2 / Dense Costs)
### Repulsion (O(n^2) + extra density pass)
- Main pair loop: `src/physics/forces.ts:42-124`.
- Distance gate uses `d2 < maxDistSq` (maxDistSq from `repulsionDistanceMax`, default 60px). Sqrt only when gate passes (`src/physics/forces.ts:56-60`).
- Early expansion density pre-pass: per-dot neighbor count uses sqrt for every pair within `densityRadius=25` (`src/physics/forces.ts:23-34`).
- Dense-core dead-zone softens repulsion inside `coreRadius=12` (`src/physics/forces.ts:61-70`).

### Collision (O(n^2))
- Pair loop with squared-distance gate: `src/physics/forces.ts:149-193`.
- Sqrt only when `distSq < minDistSq` (`src/physics/forces.ts:161-163`).
- Effective radius is `dotA.radius + dotB.radius + collisionPadding` (`src/physics/forces.ts:158-159`).

### Spacing (O(n^2))
- Pair loop in `src/physics/engine/constraints.ts:116-189`.
- Uses sqrt for every pair (no squared gate) then early exits when `d >= D_soft` (`src/physics/engine/constraints.ts:122-126`).
- `D_hard = minNodeDistance` (default 100), `D_soft = D_hard * softDistanceMultiplier` (default 150) (`src/physics/engine/constraints.ts:102-110`).
- Energy gate: spacing only runs when `energy <= 0.7`, smoothstep ramp from 0.7 -> 0.4 (`src/physics/engine/constraints.ts:104-114`).

### Other Hot Loops Worth Flagging
- Safety clamp is also O(n^2) with sqrt on every pair (`src/physics/engine/constraints.ts:306-379`).
- Triangle area constraints have an O(n^3) triangle search in worst-case dense graphs (`src/physics/engine/constraints.ts:215-230`).
- Springs do per-link local density scans over *all* dots when `energy > 0.85` (`src/physics/forces.ts:314-329`) which is O(E * N).
- Integration recomputes degree per dot by scanning all links (`src/physics/engine/integration.ts:93-100`) which is O(N * E).

## Dense Ball Trigger Conditions (Root Suspects)
- Tight initial layout: `generateRandomGraph` uses `initScale` (default 0.1) so initial spacing is ~10% of target (`src/playground/graphRandom.ts:23-70`), setting up a dense core before spacing is active.
- Spacing off during early energy: `applySpacingConstraints` is disabled until `energy <= 0.7` (`src/physics/engine/constraints.ts:104-114`), so dense packing can persist right as repulsion/collision ramp up together.
- Repulsion dead-core reduces push inside 12px (`src/physics/forces.ts:61-70`), which weakens separation in the densest blob.
- Correction budget + diffusion: per-dot correction cap `maxNodeCorrectionPerFrame` (default 0.5) and diffusion (40% self / 60% neighbors) can slow outward separation under high overlap (`src/physics/engine/corrections.ts:16-98`).
- Hub privilege + escape window: hubs skip spacing during early expansion (`energy > 0.85`) or escape window (`src/physics/engine/constraints.ts:159-163`), allowing dense core persistence.
- Springs tangential softening in dense cores (energy > 0.85) reduces shear resistance, which can let a tight cluster “slide” instead of expanding (`src/physics/forces.ts:305-350`).

## Instrumentation (Minimal Timing Counters)
- Added per-pass timing aggregation in `PhysicsEngine.tick()` with once-per-second logging when `debugPerf` is enabled (`src/physics/engine.ts:239-385`).
- Repulsion/collision/springs timing captured inside `applyForcePass` (`src/physics/engine/forcePass.ts:162-173`).
- Spacing timing wrapped around `applySpacingConstraints` (`src/physics/engine.ts:334-341`).
- PBD timing covers the correction block (`src/physics/engine.ts:331-350`).
- Enable by setting `debugPerf: true` in config (`src/physics/config.ts:121-127`).

## Timing Breakdown (To Be Measured)
- Normal sparse layout: pending manual run with `debugPerf` enabled.
- Forced dense blob layout: pending manual run; no reproducer scripted yet.
- Note: instrumentation is in place; logs appear once per second in the format:
  `[PhysicsPerf] avgMs repulsion=... collision=... springs=... spacing=... pbd=... total=... frames=...`

## Proposed Fix Strategy (Before Coding)
1) **Density-aware budgeting**: cap per-frame pair interactions when density spikes (repulsion/collision/spacing), or sample pairs so that O(n^2) work is bounded during dense blobs.
2) **Staggered hot passes**: when repulsion or spacing is hot, skip or downsample a secondary pass that frame to avoid “everything is a neighbor” spikes.
3) **Adaptive gating without jitter**: use rolling averages (not frame-to-frame toggles) to avoid oscillation when thresholds are crossed (e.g., spacing enable threshold).
4) **Localized shortlists**: build lightweight per-dot neighbor lists using a simple grid or bucket to cut pair checks while preserving the buoyant feel; avoid full quadtree unless needed.
5) **Keep buoyancy intact**: leave the de-locking passes, drift, and PBD diffusion untouched; only reduce the volume of pairwise checks, not the qualitative motion.
