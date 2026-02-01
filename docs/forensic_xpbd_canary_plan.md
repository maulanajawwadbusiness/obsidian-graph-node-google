# Forensic XPBD Prep Report

## 1. Render handoff clarity

- **Position source**: `drawLinks`, `drawNodes`, and `drawLabels` draw directly from `PhysicsNode.x/y` after they have been projected by `CameraTransform.worldToScreen`. No secondary cache or interpolation layer exists—whatever the physics loop leaves in the nodes goes straight to the canvas (`src/playground/rendering/graphDraw.ts`, `src/physics/types.ts`).
- **Finalizing stage**: The last mutator is `applyCorrectionsWithDiffusion` inside `runPhysicsTick`. `finalizePhysicsTick` immediately follows, sealing `lastGood*` metadata and sleeping flags before the render loop resumes (`src/physics/engine/engineTick.ts`, `src/physics/engine/engineTickFinalize.ts`). Introduced fixes must live between integration and this finalize call to be visible.
- **Time units**: The scheduler builds `fixedStepMs = 1000 / targetTickHz` (default 60 Hz) and clamps dt via `TimePolicy` (2–50 ms, spike detection, quarantine). Physics editor runs on `fixedStepMs / 1000`, so corrections must honour that dt—no "stretching" time, only dropping debt when overloaded (`src/physics/engine/dtPolicy.ts`, `src/playground/rendering/renderLoopScheduler.ts`, `src/physics/engine/engineTick.ts`).

## 2. Native geometry constants

- **Node radii**: Seeded graph uses radii 8 px (spine), 6 px (rib), 4 px (fiber) before theme scaling. Elegant skin multiplies by `nodeRadiusMultiplier`, so a spine dot renders ~9.6 px before hover effects (`src/playground/graphRandom.ts`, `src/visual/theme.ts`).
- **Link rest lengths**: `config.linkRestLength` is 130 px, while `targetSpacing` is 375 px. Link-specific `lengthBias` overrides (0.5/1.0/1.5) stretch or compress to yield short/normal/long springs. Every force or constraint uses `engine.config.linkRestLength` when no explicit override exists, so XPBD corrections must stay in those units (`src/physics/config.ts`, `src/physics/engine/constraints.ts`, `src/physics/engine/forcePass.ts`).

## 3. Canary verification plan

1. **Goal**: prove the XPBD correction stage actually affects `PhysicsNode.x/y` before render. Without proof we risk steering the wrong hook.
2. **Implementation**: add a dev-only flag (`config.debugXpbdCanary` or similar). When enabled, immediately after `applyCorrectionsWithDiffusion` (before `finalizePhysicsTick`) add an unmistakable shift (e.g., `node.x += 30`, `node.y += -20` or multiply positions by 1.05). If the canvas shows the shift, you are in the right stage.
3. **Cleanup**: keep the flag for future forensics but default it off. Remove the transform once you no longer need it or guard it behind a dev toggle once the real XPBD logic is live.

## 4. XPBD visibility + HUD telemetry

- **Stiffness visibility**: Temporarily amplify `springStiffness` and `repulsionStrength` so the new corrections are obvious while tuning. Keep these in px units to stay intuitive—no hidden scaling.
- **HUD metrics**: Extend `PhysicsHudSnapshot`/`updateHudSnapshot` with `springCorrectionAvg`, `springCorrectionMax`, `repelCorrectionAvg`, `repelCorrectionMax`, `repelPairs`, `constraintCount`, and `overlapCount`. Instrument the new XPBD passes (via `DebugStats.passes`) to populate these scalars each tick without allocating.
- **Performance hygiene**: Leverage existing caches (`correctionAccumCache`, `DebugStats` entries, scratch arrays) instead of allocating arrays each frame. Reset per-frame scalars to avoid GC spikes.
- **Constraint visibility**: Track exactly how many constraints/pairs each pass processed so the HUD can say “Spring constraints: X, Repel pairs: Y.” That is also how you verify the pass ran (it increments the counters).

## 5. Minimal diff doctrine

- Touch only the XPBD passes and HUD wiring. Leave diffusion, micro-slip, and escape logic untouched this round; they already live in `velocityPass`/`engineTick`.
- Keep pointer ownership, 60 Hz budget, and no-new-DOM touches as before. The canary/toggles stay inside the physics loop.

## 6. Immediate next moves

1. Add the CANARY flag described above and verify the shifted render appears so you can prove you operate before `finalizePhysicsTick`.
2. Implement XPBD springs + repulsion in the window between integration/corrections and finalize, gate them behind toggles, and wire the HUD metrics listed in §4.
3. Once the new passes are visible, rerun `docs/repo_xray.md`/`docs/onboarding_dpr_rendering.md` manual checks and record findings in this file before committing.

## 7. Second-core integration briefing

### Run 1 – XPBD springs

- **Insert point**: The only safe hook is immediately after the existing correction pass (`applyCorrectionsWithDiffusion`) but before `finalizePhysicsTick`. Nothing else may mutate `node.x/y` afterwards, or your visible result will be overwritten.
- **Existing conflict**:
  * `applySprings` already enforces link rest lengths. Running XPBD springs alongside it doubles corrections and violates the “No Mud” degrade policy. When the new core is enabled, make `applySprings` a no-op or remove the forces entirely.
  * `correctionAccumCache` already budgets spacing/safety corrections. XPBD will need its own accumulator or reuse the existing one carefully (resetting per-tick) to avoid clobbering the budget and adding drift.
  * `motionPolicy` and scheduler budgets assume springs are normalized by `dt`. Your XPBD compliance must use the same `dtUseSec` from `TimePolicy`. Otherwise “Force Stiff Springs” will accidentally trip degrade/budget logic and drop physics steps.
- **Wiring guide**:
  * Guard the pass with a clear config flag so you can toggle between hybrid and XPBD cores.
  * Disable the legacy spring force when XPBD is active.
  * Record `SpringCorrAvg`, `SpringCorrMax`, and `constraintCount` in `DebugStats`/`PhysicsHudSnapshot` so the HUD reveals whether the pass is running.
  * “Force Stiff Springs” toggle should temporarily reduce compliance or raise iterations but not mutate render-facing data when off.

### Run 2 – Short-range repulsion

- **Insert point**: Place the repulsion constraint after springs but before `finalizePhysicsTick`. Forces (repulsion/collision) should settle first; the constraint then ensures no overlaps remain.
- **Existing conflict**:
  * `applyRepulsion`/`applyCollision` already push nodes apart. Running an XPBD repulsion on top doubles effort and might permanently separate nodes beyond `minNodeDistance`.
  * Neighbor iteration already strided in `applyRepulsion`. Reiterating over `nodeList` without sharing stride logic will blow up to O(N²) and violate budget expectations.
  * HUD already tracks spacing stats elsewhere. Only instrument the new XPBD repulsion pass to populate `RepelPairs`, `RepelCorrAvg`, `RepelCorrMax`, and `OverlapCount` so you can prove it ran.
- **Wiring tips**:
  * Compute `minDist = node.radius * 2 + margin` once per frame (per radius class) to avoid redundant multiplications.
  * Use XPBD compliance (α/dt²) so the pass remains stable even under large `dt`. Classic PBD clamps can work if you store last corrections for HUD counters.
  * Add `Force Repulsion` dev toggle (coupled to `config.debugPerf` or a new flag) that temporarily decreases compliance or increases correction magnitude to make the pass instantly visible.
  * Feed the HUD counters into `PhysicsHudSnapshot`/`updateHudSnapshot` without allocating per frame.

### Knife-sharp readiness checklist

1. **Flag isolation**: Always run either the existing hybrid core or the new XPBD core—never both simultaneously.
2. **Stats coverage**: The HUD must show `SpringCorrAvg/Max`, `RepelCorrAvg/Max`, `RepelPairs`, `OverlapCount`, and `constraintCount` so observers immediately see which core produced the scene.
3. **Canaries enabled**: Keep “Force Stiff Springs” and “Force Repulsion” toggles available during rollout; they are the quickest proof the new passes hit render.
4. **Budget/dt sanity**: After wiring the constraints, re-check scheduler limits (`maxStepsPerFrame`, `accumulator` logic, scheduler budgets) to ensure you still drop debt rather than stretch time.
5. **Render guarantee**: The CANARY transform must be visible on-screen whenever a pass updates positions, proving the corrected `PhysicsNode` values survive until `drawNodes`/`drawLinks` draw them—if you can’t see the shift, abort and investigate earlier stages before proceeding.
6. **Unit fidelity**: Verify spring lengths, node radii, and correction magnitudes are in raw pixels (no 1/10 scaling) by comparing HUD stats/hooks with the native `linkRestLength`/`node.radius` units before release; the CANARY must use the same scale so the on-screen effect matches the physics numbers exactly.

If the conflicts above cannot be resolved cleanly, leave the hybrid solver as-is and keep the new XPBD logic guarded behind dev flags until you can fully validate the second core.
