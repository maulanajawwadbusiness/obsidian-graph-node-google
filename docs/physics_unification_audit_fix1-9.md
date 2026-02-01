# Physics Unification Audit (Fixes 1-9)

Built on the 0-slush doctrine documented in `docs/physics_xray.md` (degrade buckets + forced 1:1 time), the repo map in `docs/repo_xray.md`, and the follow-up for the micro-slip predicate (`docs/forensic_micro_slip_predicate_and_cooldown.md`) and diffusion hardening (`docs/forensic_diffusion_decay_and_history_reconcile.md`). This forensic pass reconfirms what the last nine fixes delivered, where they live, why they work, and what still deserves a knife-grade watch.

## 1. Bedrock Map of Fixes 1-9

### Fix 1 – Time & Firewall Integrity
- **What changed:** The tick front-end now clamps/quantizes every delta and enforces the `TimePolicy`/firewall tuple before anything else (`src/physics/engine/engineTick.ts:36-120` and `src/physics/engine/engineTickPreflight.ts:18-120`). Every node’s `prevX/prevY` snapshot happens here and velocity clamping logs to `engine.firewallStats`.
- **Invariants:** `policyResult.dtUseSec` remains under the capped max step (`maxFrameDeltaMs = 120`), nan/inf resets rewrite the node to its last-good projection, and busy frames increment `dtSpikeCount`/`quarantineStrength` for the HUD.
- **Key code:** `runTickPreflight` (node checks + `stuckScore`), `engine.timePolicy.evaluate(dtIn * 1000)` plus the surrounding clamps, and the early `if (policyResult.isSpike)` path that counts clamps.
- **Telemetry:** HUD fields `dtRawMs`, `dtUseMs`, `dtSpikeCount`, `quarantineStrength`, and the `dtSkew` diagnostics inside `engineTickHud.ts:108-192` give immediate visibility of every decision.
- **What could still fail:** Large `dt` spikes still drop entire frames, so downstream inertia (e.g., HUD gating) must not assume every tick ran; the `idleFrames` counter might skip resets when the engine lifecycle resets. Watch for `TimePolicy` not scaling damping when `dt` suddenly halves.
- **Next:** Monitor `debugStats.dtSkew` and `hudSnapshot.coverageMode` to validate that the clamps/data remain consistent across browser ticks.

### Fix 2 – Motion Policy + Diffusion Hardening
- **What changed:** `createMotionPolicy` now blends energy into `diffusion`, `settleScalar`, `hubInertiaBlend`, etc., and the tick smoothly ramps `settleScalar` as calm% approaches 98% before dropping diffusion through `(1 - settleScalar)^2` (`src/physics/engine/motionPolicy.ts:1-45` and `src/physics/engine/engineTick.ts:225-256`).
- **Invariants:** Diffusion/gating lives in [0,1]; `calmPercent` and `motionPolicy.settleScalar` only grow once energy truly drops, and `policy.diffusion` is zeroed by energy thresholds before corrections run.
- **Key code:** Ramp calculation (`engineTick.ts:231-244`), the `diffusionSettleGate` instrumentation (`engineTick.ts:248-260`), and the `enableDiffusion` gate inside `applyCorrectionsWithDiffusion` (`src/physics/engine/corrections.ts:104-120`).
- **Telemetry:** `stats.diffusionGate`, `stats.diffusionStrengthNow`, and `debugStats.diffusionPopScore` (all surfaced via `engineTickHud` and `physicsHud`) let us watch the gate progression.
- **Risks left:** `stats.diffusionStrengthNow` is only written when `degree > 1 && enableDiffusion` fires, so idle frames keep the last non-zero value (see `corrections.ts:320-347`).
- **Next:** Reset `diffusionStrengthNow` to `0` whenever diffusion is skipped, and consider logging a per-node gate to catch outliers.

### Fix 3 – Repulsion & Force Pass Stabilization
- **What changed:** The force pass now respects energy-scaled repulsion (`forcePass.ts:190-240`), soft radius/stride reduce jitter, and `forces.ts` clamps/softens any hardcore overlaps via `repulsionMinDistance`, `repulsionMaxForce`, and density boosts with hysteresis (`forces.ts:40-220`).
- **Invariants:** 2x pass stride is deterministic via `shouldSkipPair`, each pair uses a seeded fallback when `dx/dy` are zero, density boosts are clamped to 3x, and forces scale by the global `forceScale`.
- **Key code:** `applyRepulsion`’s density cache + hysteresis (`forces.ts:43-120`), `repulsionScale`/`densityBoost` logic (`forces.ts:156-220`), and the `shouldSkipPair` stride guard within `applyRepulsion` and `applyCollision`.
- **Telemetry:** `stats.safety.repulsionClampedCount`, `stats.safety.repulsionMaxMag`, and `engineTickHud` fields `minPairDist`, `nearOverlapCount`, `repulsionMaxMag`.
- **Risks:** Fallback pushes still call `Math.random` (`forces.ts:319-330`, `374-381`, `626-633`), which breaks the determinism checksum and makes long-run playback bit-unequal.
- **Next:** Replace those fallback nudges with the deterministic `pseudoRandom`/`hashString` helpers from `engine/random.ts` and capture the resulting vector in telemetry for verification.

### Fix 4 – Constraint Passes (Spacing, Safety, Triangles)
- **What changed:** Spacing now has a priority pass (`hotPairs`), hub relief via `policy.earlyExpansion`, and strong history-following (`constraints.ts:184-418`), the triangle pass decays stiffening near degenerate triangles (`constraints.ts:434-520`), and the safety clamp enforces `deep penetration` correction with the same hub-aware gating (`constraints.ts:593-690`).
- **Invariants:** Dangling (`deg=1`) dots don’t move, hub nodes gradually relieve via the ramp `1 - policy.earlyExpansion * hubK`, and priority hot pairs are processed in sorted order to keep the iteration deterministic (`constraints.ts:352-384`).
- **Key code:** `applyPairLogic` (history updates), `hotPairs` priority pass (`constraints.ts:353-385`), triangle area guard (lines 434-516), and safety clamp guard around `penetration > 5` (lines 604-650).
- **Telemetry:** `stats.safety.penetrationCount`, `stats.degenerateTriangleCount`, and `engineTickHud`’s `orderMode`, `corrSignFlipRate`, `restFlapRate` provide signals for constraint health.
- **Risks:** Triangle detection still does brute-force `(N^3)` scanning over node triples (`constraints.ts:452-496`), so dense graphs (500+ nodes) pay a heavy CPU tax every frame.
- **Next:** Pre-calc adjacency triangles or skip triangle pass when spacing stride is high. Also consider expiring `hotPairs` entries for nodes that no longer exist to avoid wasteful lookups.

### Fix 5 – Correction Diffusion & Residual
- **What changed:** The correction pass clamps budgets, stores residual debt, and diffuses the remaining correction to neighbors while keeping velocity history consistent (`corrections.ts:59-430`).
- **Invariants:** `node.correctionResidual` is cleared when fixed/deg=1/small corrections, `diffusedCorrection` map collects neighbor contributions, and each move updates `prevX/prevY` so ghost velocity checks stay zero (`corrections.ts:248-348`).
- **Key code:** Residual bookkeeping around `budgetScale < 1.0` (`corrections.ts:212-256`), diffusion loop (`corrections.ts:270-414`), and the follow-up pass that clamps diffused corrections to budget while reconciling history (`corrections.ts:420-430`).
- **Telemetry:** `stats.correctionConflictCount`, `stats.diffusionStrengthNow`, and `stats.ghostMismatchCount` (surfaced by `physicsHud`/`engineTickHud`) show whether the pass is still fighting velocity.
- **Risks:** Diffusion instrumentation only writes under the `if (degree > 1 && enableDiffusion)` path, so the HUD reports stale strength whenever diffusion is gated off for a node (see `corrections.ts:320-347`).
- **Next:** Add a `stats.diffusionStrengthNow = 0` in the `else` block and consider logging when residual debt frequently crosses the `resMag > 0.5` cutoff.

### Fix 6 – Micro-Slip / Stagnation Escape Hardening
- **What changed:** The heartbeat drivers now rely on `node.stuckScore` and 1-second cooldowns before they inject energy, and they honor constraint direction to avoid fighting PBD (`staticFrictionBypass.ts:58-140`, `lowForceStagnationEscape.ts:1-130`, `edgeShearStagnationEscape.ts:1-185`).
- **Invariants:** Each injector gates on `policy.diffusion * settleGate`, rejects the user’s dragged node, and writes `lastMicroSlipMs` so it can’t fire again inside the cooldown window.
- **Key code:** Cooldown/stuck guard in `staticFrictionBypass.ts:65-110`, the constraint-aware dot product check in `edgeShearStagnationEscape.ts:120-175`, and the `stuckScore` computation in `engineTickPreflight.ts:36-80`.
- **Telemetry:** `stats.injectors.microSlipCount`, `microSlipFiresPerSec`, `stuckScoreAvg`, `engineTickHud`’s `lastInjector`/`driftCount` ensure the heartbeat stays invisible.
- **Risks:** Each injector recomputes local density via nested loops (`nodeList` × `nodeList`), so scenes with 500+ dots still pay N² per injector (see density builds around `staticFrictionBypass.ts:58-90` and `edgeShearStagnationEscape.ts:34-80`).
- **Next:** Cache density counts (e.g., reuse `engine.neighborCache`) or throttle the micro-slip passes to every few frames when node count spikes.

### Fix 7 – Stuck Score & Pressure Diagnostics
- **What changed:** `runTickPreflight` now stores `node.stuckScore = calmFactor * pressureFactor`, zeroes it for fixed/dragged dots, and adds it to `debugStats.injectors.stuckScoreSum` (`engineTickPreflight.ts:36-80`).
- **Invariants:** Every node’s stuck score reflects both low speed and non-trivial correction pressure, and the HUD average (`hudSnapshot.stuckScoreAvg`) is recomputed each tick (`engineTickHud.ts:150-210`).
- **Key code:** Calm factor/residual at `engineTickPreflight.ts:44-68`, plus the aggregator that resets `stats.injectors.stuckScoreSum` and writes it into `hudSnapshot` and the HUD scoreboard.
- **Risks:** `lastCorrectionMag` needs to be kept fresh before the preflight loop; if another pass updates it after preflight, the score could lag.
- **Next:** Thread `lastCorrectionMag` updates into the preflight snapshot (or re-run a micro-sample) to keep the stuck score synchronous.

### Fix 8 – Numeric Rebase & Determinism
- **What changed:** Each tick calculates a checksum over quantized node positions, snaps tiny velocities to zero when calm, and recenters the world if any node wanders past 50k units (with `debugStats.rebaseCount++`) (`engineTick.ts:248-320`, `physicsHud.ts:24-60`).
- **Invariants:** `debugStats.determinismChecksum` changes only when the actual layout drifts, `rebaseCount` increments every time the centroid shift fires, and velocity snaps occur only when calm (>95% nodes calm) and no drag is active.
- **Key code:** Determinism hash/rebase block (`engineTick.ts:248-320`), `physicsHud.ts:28-60`, and the `stats` definition for checksum/rebase fields (`stats.ts:68-120`).
- **Risks:** The rebase currently leaves a `TODO: signal camera to shift` (`engineTick.ts:321`) so renderers that draw absolute pixels might still see a jump even though physics is stable.
- **Next:** Emit an event or update the camera transform whenever the centroid subtraction runs, and watch `hudSnapshot.maxAbsPos` for unexpected spikes.

### Fix 9 – Observability / Physics HUD
- **What changed:** The HUD now polls `debugStats` for every metric we care about (settle, diffusion, conflict, micro-slip, determinism) via `engineTickHud.ts:80-210` and surfaces them in `physicsHud.ts` along with the history tables.
- **Invariants:** Every HUD field has a backing `stats` property or derived value (e.g., `diffusionGate`, `neighborDeltaRate`, `ghostMismatchCount`), so the dev tooling always shows the latest health snapshot.
- **Key code:** `updateHudSnapshot` (collecting `ghostVelSuspectCount`, `jitterAvg`, `conflictPct5s`, etc.) and `PhysicsHudSnapshot` definitions (`physicsHud.ts:1-120`).
- **Telemetry:** Every field listed above plus `dtSkew`, `microSlipFiresPerSec`, `escapeLoopSuspectCount`, and checks like `maxPrevGap`/`correctionBudgetHits` keep the team honest.
- **Risks:** None beyond the usual check that HUD sampling doesn’t throttle anything; the instrumentation already clears stats after pushing to the HUD to avoid stale carry-over.
- **Next:** Keep watching `engine.hudHistory` windows to ensure `degradePct5s` and `conflictPct5s` still look stable under long runs.

## 2. Implementation Audit Checklist (a-j)
- **a) Single continuous law (no mode pops)** – ? solid. `engineTick.ts:231-344` blends `settleScalar`, `engineTickSpacing.ts:17-45` uses hysteresis, and the degrade-mode thresholds at `engineTick.ts:205-213` are smooth rather than binary.
- **b) DT/time robustness** – ? solid. `engine.timePolicy.evaluate` clamps spikes (`engineTick.ts:47-58`), `runTickPreflight.ts:18-110` clamps velocities, and HUD fields record every clamp.
- **c) Projection/history reconciliation** – ? solid. Spacing/triangle/safety passes each update `prevX/prevY` (`constraints.ts:210-240`, `constraints.ts:452-516`, `constraints.ts:604-650`), and the correction pass (`corrections.ts:248-348`) reconciles before diffusing.
- **d) Constraints (order, budget, debt)** – ? solid. `hotPairs` loops in sorted order (`constraints.ts:353-384`), `node.correctionResidual` stores unpaid debt (`corrections.ts:212-256`), and HUD counters (`correctionBudgetHits`, `corrClippedTotal`) track clipping.
- **e) Degeneracy / over-constraint** – ? solid. Triangle pass guard (`constraints.ts:462-506`) caps corrections when the triangle is nearly flat and increments `stats.degenerateTriangleCount`.
- **f) Repulsion singularities + neighbor jitter** – ?? risky. Exact-overlap fallbacks still call `Math.random` (`forces.ts:319-330`, `374-381`, `626-633`), violating the deterministic checksum.
- **g) Diffusion (no hidden motor)** – ?? risky. `stats.diffusionStrengthNow` never resets when diffusion is skipped, confusing the HUD about whether the engine is truly at rest (`corrections.ts:320-347`).
- **h) Micro-slip / stagnation escape** – ? solid. Cooldowns/stuck scores and constraint-aware dot products (`staticFrictionBypass.ts:65-110`, `edgeShearStagnationEscape.ts:120-175`) keep the injectors from fighting the solver.
- **i) Rest/sleep ladder stability** – ? solid. `calmPercent` evaluation (`engineTick.ts:188-214`) plus `idleFrames` ensures rest happens only when nearly every dot cooperates.
- **j) Numeric robustness / cross-browser stability** – ?? risky. Rebase/checksum logic (`engineTick.ts:248-320`, `physicsHud.ts:24-60`) is sound, but `Math.random`-based fallbacks (see item f) break the checksum across platforms.

## 3. Knife Verdict: Top 10 Risks
1. **Stale diffusion strength** (`src/physics/engine/corrections.ts:320-347`). Diffusion HUD fields currently hold the last sampled value even when the gate is closed, so operators can’t tell when diffusion truly died. Fix: assign `stats.diffusionStrengthNow = 0` (and reset `diffusionPopScore`) whenever diffusion gets skipped.
2. **Non-deterministic fallback pushes** (`src/physics/forces.ts:319-330`, `374-381`, `626-633`). Those `Math.random` nudges break the checksum/rebase promise; swap them for `pseudoRandom` seeded by node IDs for deterministic drift.
3. **Renderer not warned when rebase shifts the world** (`src/physics/engine/engineTick.ts:298-321`). The centroid subtraction changes every `node.x`/`node.prevX` but the camera never hears about it, so a non-tracking camera sees a visible jump. Fix: emit a shift event or apply the same delta to the renderer’s transform.
4. **Triangle detection is brute-force** (`src/physics/engine/constraints.ts:452-496`). Every tick scans all triples, so large graphs pay O(N³). The triangle pass is important, but the search should be cached via adjacency lists or limited to active triangles.
5. **Hot pair set can grow stale** (`src/physics/engine/constraints.ts:352-385`). If a node disappears or becomes fixed before a priority pass resolves it, the string key never gets purged, so `hotPairs` retains dead entries and wastes processing time. Fix: remove keys whose nodes are missing before the sorted loop.
6. **Density counts are recomputed per micro-slip pass** (`staticFrictionBypass.ts:58-90`, `edgeShearStagnationEscape.ts:34-80`). Each injector loops over the entire `nodeList` to recompute densities, so heavy scenes trigger 2-3 N² passes each tick. Cache densities or throttle the injector frequency.
7. **Low-force escape rescans all links for each neighbor** (`lowForceStagnationEscape.ts:53-90`). Rest length lookup is done inside the neighbor loop using an inner `for (const link of engine.links)` scan, multiplying complexity by the link count. Maintain adjacency maps or store rest length on the neighbor list.
8. **Spacing gate stride toggles near thresholds** (`src/physics/engine/engineTickSpacing.ts:17-46`). When energy hovers around `spacingGateOn/Off` (0.72/0.78) the `spacingStride` can flip between 1 and 8, which may awaken “law pop” jitter. Monitor `hudSnapshot.coverageMode` and consider widening the hysteresis window.
9. **Repulsion density hysteresis still discrete** (`src/physics/forces.ts:70-120`). Neighbor counts still flip by ±1 when a dot crosses a fixed radius, so `densityBoost` jumps, creating residual pushes. Smoothing the count (EMA) or sampling multiple radii would keep the force continuous.
10. **Edge escape cooldown measured on `engine.lifecycle`** (`staticFrictionBypass.ts:65-110`, `edgeShearStagnationEscape.ts:77-130`). If the tick is paused or frame-dropped, the 1-second cooldown no longer matches real time; use `getNowMs()` or another wall-clock timer for consistent heartbeats.

> **System fights:** The two currently fighting principals are constraints vs. diffusion (both touch the same correction vector in `constraints.ts:184-420` and `corrections.ts:270-430`) and repulsion vs. spacing (repulsion’s density boost nudges nodes directly back into the zone that spacing is trying to unclog). These fights are watched via `stats.correctionConflictCount`, `ghostMismatchCount`, and HUD metrics like `conflictPct5s` + `jitterAvg`.

## 4. Optional improvements
- None beyond the telemetry + determinism fixes noted above.
## Implementation Plan

1. **Phase 0 – Deep Scandissect**
   - Read the full call sites for the top-10 risks (forces overlap fallbacks, diffusion gating, rebase/centroid shift, spacing/triangle passes, micro-slip escapes, HUD wiring) to map the surrounding logic and identify additional law pops.
   - Trace each HUD field from writer to clear/reset to sampling so the 'data truth path' is explicit.
   - Document any remaining hard-threshold jumps or hidden motors outside the audit's current list.

2. **Phase 1 – Knife-Precise Fixes**
   - **Determinism:** replace every Math.random overlap fallback in src/physics/forces.ts with seeded pseudoRandom output, add telemetry counters for fallback usage, and ensure the checksum/rebase fields stay stable.
   - **Diffusion HUD:** in src/physics/engine/corrections.ts, reset stats.diffusionStrengthNow (and diffusionPopScore if needed) whenever diffusion is bypassed so the HUD immediately reads 0 once the gate closes.
   - **Rebase/Camera:** when centroid rebase subtracts (cx,cy) in engineTick.ts, emit a tiny camera shift event or apply the delta to the renderer's transform to avoid visual jumps.
   - **Scale/Perf:** replace the brute O(N^3) triangle scan with cached adjacency-based enumeration, prune stale hotPairs, share a cached localDensity map across micro-slip injectors (and low-force escape), and smooth the spacing gate stride/hysteresis plus repulsion density boost. Switch micro-slip cooldowns over to wall-clock time (getNowMs()).

3. **Phase 2 – Verification**
   - Run the scene at N=5/20/60 (plus higher counts if practical) and compare HUD stats to confirm motion law consistency.
   - Validate the determinism checksum remains equal across runs and that fallback telemetry values stay zero.
   - Confirm the HUD reflects true diffusion/collision states (diffusion zero when gated, conflict%/settle states accurate).
   - Ensure triangle and density passes scale without exploding timing.

4. **Deliverables**
   - Keep diffs minimal, avoid new thresholds, and route any gating through motionPolicy.
   - Add lightweight instrumentation only where needed for verification (overlap fallback counter, HUD truth).
   - Create docs/<date>_physics_fix_top10_risks.md describing what changed, why, file paths, and how to verify using the HUD.
   - Commit with a clear message (e.g., fix(physics): harden top 10 risks).

