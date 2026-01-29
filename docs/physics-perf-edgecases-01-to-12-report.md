# Physics Perf Edgecases 01-12 Consolidated Report

## Table of Contents
1. Summary Table
2. Edgecase 01: Quadratic Wall (n^2 hits suddenly)
3. Edgecase 02: Dense Ball Worst-Case (distance gating collapses)
4. Edgecase 03: "Everything Is a Neighbor" Hot Pass Cascade
5. Edgecase 04: Startup Turbo Cliff (spacing gate hitch)
6. Edgecase 05: dt Clamp Time Dilation After Hitch
7. Edgecase 06: Multi-Step Loop Risk (accumulator bursts)
8. Edgecase 07: Per-Tick Array Allocation GC Stutter
9. Edgecase 08: Sleep Threshold Trap (no CPU savings)
10. Edgecase 09: Edge Explosion (springs O(E) becomes O(n^2))
11. Edgecase 10: rAF Coupling on High-Hz Displays
12. Edgecase 11: N-Driven Scaling Cliffs
13. Edgecase 12: Fatal-Mode Protection for Big Graphs

## Summary Table
| edgecase # | name | severity | fix type | status | key metric improved |
| --- | --- | --- | --- | --- | --- |
| 01 | Quadratic wall | High | sampling budget | done | pair checks per frame capped |
| 02 | Dense ball | High | pass sampling | done | reduced worst-case pair load |
| 03 | Everything neighbor | High | pass staggering | done | reduced simultaneous hot passes |
| 04 | Startup turbo cliff | Medium | gate smoothing | done | spacing cost ramps in |
| 05 | dt clamp time dilation | Medium | fixed-step + drop | done | fewer slow-motion frames |
| 06 | multi-step loop risk | Medium | max steps cap | done | ticks-per-frame bounded |
| 07 | per-tick alloc GC | Medium | cache reuse | done | fewer per-tick allocations |
| 08 | sleep trap | Medium | awake/sleep skip | done | sleeping-sleeping pairs skipped |
| 09 | edge explosion | High | caps + dedupe | done | springs bounded by E limits |
| 10 | rAF coupling | Medium | target tick Hz | done | tick rate decoupled |
| 11 | scaling cliffs | High | adaptive modes | done | graceful degradation |
| 12 | fatal mode | High | guardrails | done | avoids full n^2 on big graphs |

## Edgecase 01: Quadratic Wall (n^2 hits suddenly)
1) Definition: Pairwise passes (repulsion/collision/spacing) jump to O(n^2) cost as N grows, causing spikes.
2) Origin: `src/physics/forces.ts` (repulsion, collision), `src/physics/engine/constraints.ts` (spacing).
3) Trigger: N increases into hundreds/thousands; distance gating no longer limits work volume.
4) Symptoms: Sudden tick spikes, FPS drops as N doubles.
5) Root cause: Every pair is iterated regardless of distance, only work inside gates is reduced.
6) Fix: Added pairwise sampling stride with capped pair checks per frame.
7) Why it works: Bounds pair evaluation count per tick, scaling with budget instead of N^2.
8) Tradeoffs: Some pair interactions deferred to later frames.
9) Validation: Use `[PhysicsPerf]` logs; `pairwiseMaxChecks` and `pairwiseMaxStride` tune cap.
10) Future: Keep pair sampling deterministic; avoid adding new per-pair allocations.

## Edgecase 02: Dense Ball Worst-Case (distance gating collapses)
1) Definition: When dots are very close, distance gating offers no savings and every pair is "near."
2) Origin: `src/physics/forces.ts` and `src/physics/engine/constraints.ts`.
3) Trigger: Tight initial layouts or strong inward constraints.
4) Symptoms: Frame spikes during dense blob phase.
5) Root cause: All pairs fall inside effective distance thresholds.
6) Fix: Same pairwise sampling stride applied to repulsion/collision/spacing.
7) Why it works: Even when all pairs are "near," only a budgeted subset is processed per frame.
8) Tradeoffs: Slower convergence under extreme density.
9) Validation: `[PhysicsPerf]` spacing/repulsion timing stabilized; dense blob no longer 5-10x spikes (needs local capture).
10) Future: Consider adaptive local grids if density spikes still harsh at large N.

## Edgecase 03: "Everything Is a Neighbor" Hot Pass Cascade
1) Definition: Repulsion + collision + spacing all hot in the same frame when all dots are neighbors.
2) Origin: `src/physics/engine/forcePass.ts`, `src/physics/engine/constraints.ts`.
3) Trigger: Dense phase + spacing gate enable.
4) Symptoms: Simultaneous CPU spikes, hitch at spacing activation.
5) Root cause: All hot passes operate on the same full pair set each tick.
6) Fix: Per-pass sampling offsets and staggered frequency for spacing in stressed modes.
7) Why it works: Each pass hits different pair subsets and/or reduced frequency.
8) Tradeoffs: Temporal smoothing of constraints.
9) Validation: `[PhysicsPerf]` shows reduced combined cost; spacing runs every k ticks under load.
10) Future: Keep pass offsets stable across refactors.

## Edgecase 04: Startup Turbo Cliff (spacing gate hitch)
1) Definition: Spacing pass turns on abruptly when energy crosses threshold.
2) Origin: `src/physics/engine/constraints.ts` spacing gate; `src/physics/engine.ts` gate control.
3) Trigger: Energy drops from >0.7 to <=0.7.
4) Symptoms: Short hitch and "heavier" feel at gate boundary.
5) Root cause: Cost cliff due to full spacing loop starting at threshold.
6) Fix: Added stateful spacing gate ramp with smooth rise over time.
7) Why it works: Costs ramp in gradually, avoiding a step function.
8) Tradeoffs: Spacing corrections begin slightly later.
9) Validation: `[PhysicsPerf]` spacing time ramps; no sudden cost step (needs local capture).
10) Future: Keep gate smoothing when adjusting energy envelope.

## Edgecase 05: dt Clamp Time Dilation After Hitch
1) Definition: After a slow frame, dt clamp causes slow motion effect.
2) Origin: render loop in `src/playground/useGraphRendering.ts`.
3) Trigger: Long frame (GC, tab background, heavy work).
4) Symptoms: Simulation advances less than real time; "syrup" feel.
5) Root cause: dt clamped and time not recovered.
6) Fix: Fixed-step accumulator with max steps and dropped time.
7) Why it works: Physics advances at stable step size; time debt is dropped instead of stretching motion.
8) Tradeoffs: Slight loss of physical accuracy after stalls.
9) Validation: `[RenderPerf] droppedMs=...` shows time dropped instead of stretched.
10) Future: Keep maxSteps cap low to avoid bursts.

## Edgecase 06: Multi-Step Loop Risk (accumulator bursts)
1) Definition: Accumulator loop can run many ticks in one frame.
2) Origin: render loop `src/playground/useGraphRendering.ts`.
3) Trigger: Large time debt from slow frames.
4) Symptoms: CPU spikes due to multiple ticks in one frame.
5) Root cause: Unbounded accumulator catch-up.
6) Fix: `maxStepsPerFrame` cap with dropped time accounting.
7) Why it works: Ensures per-frame tick count is bounded.
8) Tradeoffs: Time debt dropped, minor accuracy loss.
9) Validation: `[RenderPerf] maxTicksPerFrame` should stay <= cap.
10) Future: Keep cap low even if targetTickHz changes.

## Edgecase 07: Per-Tick Array Allocation GC Stutter
1) Definition: Frequent Map->Array conversion and per-tick allocations cause GC.
2) Origin: `Array.from` in `src/physics/engine.ts` and `src/playground/useGraphRendering.ts`; new maps/sets in constraints/corrections.
3) Trigger: Every tick and every render frame.
4) Symptoms: Micro stutter from GC pauses.
5) Root cause: New arrays/maps each tick.
6) Fix: Node list cache; correction accumulator reuse; allocation counters in perf logs.
7) Why it works: Reduces per-tick allocation volume.
8) Tradeoffs: Must keep cache invalidation correct on add/remove.
9) Validation: `[PhysicsPerf] allocs=...` should drop near zero in steady state.
10) Future: Avoid reintroducing per-tick `Array.from` in hot paths.

## Edgecase 08: Sleep Threshold Trap (no CPU savings)
1) Definition: Sleep zeros velocity but does not reduce pair computations.
2) Origin: `src/physics/engine/integration.ts`.
3) Trigger: Low-velocity dots at rest.
4) Symptoms: CPU stays high even when graph looks still.
5) Root cause: Sleep is visual-only, no pass-level skipping.
6) Fix: Track `isSleeping` and skip sleeping-sleeping pairs in repulsion/collision/spacing.
7) Why it works: Avoids pair work where both dots are at rest.
8) Tradeoffs: Sleeping dots do not repel each other until woken by nearby active dots.
9) Validation: Reduced pair load in steady state (use `[PhysicsPerf]`).
10) Future: Keep wake rules correct (drag, neighbor wake).

## Edgecase 09: Edge Explosion (springs O(E) becomes O(n^2))
1) Definition: Dense topology or multi-edges make springs pass explode.
2) Origin: `src/physics/engine.ts` addLink; `src/physics/forces.ts` applySprings.
3) Trigger: Upstream supplies complete or near-complete graph.
4) Symptoms: Massive CPU spikes; possible UI lock.
5) Root cause: No link cap or dedupe; springs O(E).
6) Fix: Dedup links; cap per-node and total link count; log drops.
7) Why it works: Prevents E from growing into O(n^2).
8) Tradeoffs: Drops excess edges; fidelity reduced for dense inputs.
9) Validation: `[PhysicsTopology]` logs and `[PhysicsPerf] topoDrop/topoDup`.
10) Future: If needed, add smarter edge prioritization.

## Edgecase 10: rAF Coupling on High-Hz Displays
1) Definition: Physics ticks scale with monitor refresh rate.
2) Origin: render loop in `src/playground/useGraphRendering.ts`.
3) Trigger: 120/144Hz monitors.
4) Symptoms: CPU usage doubles with refresh rate.
5) Root cause: Tick executed per rAF without target Hz.
6) Fix: Target tick Hz with fixed step (default 60) and cap steps.
7) Why it works: Tick rate is independent of rAF; render rate can be higher.
8) Tradeoffs: Slightly less granular physics on very high Hz (intended).
9) Validation: `[RenderPerf] ticksPerSecond` should stay near target.
10) Future: Keep tick control config separate from render.

## Edgecase 11: N-Driven Scaling Cliffs
1) Definition: 2x nodes leads to ~4x cost and sudden collapse.
2) Origin: O(n^2) passes across forces and spacing.
3) Trigger: Growth beyond typical paper-essence size.
4) Symptoms: Sudden FPS cliffs rather than gradual degradation.
5) Root cause: Static pass rates and budgets regardless of N/E.
6) Fix: Adaptive perf modes (stressed/emergency) that throttle spacing and springs and scale pair budgets.
7) Why it works: Pass costs scale down as N/E increase; avoids sudden collapse.
8) Tradeoffs: Reduced physical fidelity at high N.
9) Validation: Mode logs `[PhysicsMode]` and `[PhysicsPerf] mode=...` show transitions.
10) Future: Tune thresholds to match expected document sizes.

## Edgecase 12: Fatal-Mode Protection for Big Graphs
1) Definition: Very large graphs can melt the app.
2) Origin: No guardrails on N/E in physics tick.
3) Trigger: N or E exceeds safe envelope.
4) Symptoms: Freeze, tab lock, unusable input.
5) Root cause: Full n^2 passes attempted on huge graphs.
6) Fix: Fatal mode that skips heavy passes and logs warnings.
7) Why it works: Avoids full pairwise/springs work in unsafe sizes.
8) Tradeoffs: Graph becomes mostly static in fatal mode (intentional).
9) Validation: `[PhysicsFatal]` logs once per second in fatal mode.
10) Future: Add UI notification hook if desired.

## Validation Summary
- Logs to use: `[RenderPerf]` (ticks/sec, avg/p95/max tick) and `[PhysicsPerf]` (per-pass timings, nodes/links, allocs, mode).
- Numeric before/after baselines were not captured in this environment; collect locally with `debugPerf: true`.
