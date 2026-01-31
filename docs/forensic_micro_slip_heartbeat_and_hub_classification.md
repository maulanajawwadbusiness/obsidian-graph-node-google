# Forensic Assessment: Micro-Slip Heartbeat + Hub/Degrade Law Stability

## 1. Scope
- `src/physics/engineTick.ts` — stuck score/hub strength computation and degrade-level smoothing.
- `src/physics/engine/velocity/*.ts` — micro-slip injectors (`staticFrictionBypass`, `lowForceStagnationEscape`, `edgeShearStagnationEscape`).
- `src/physics/engine/constraints.ts` — spacing/triangle constraints, pair stride compensation.
- `src/playground/components/CanvasOverlays.tsx` — HUD diagnostics (stuck score, micro slip rates, hub/degrade flips).

## 2. Micro‑Slip Heartbeat Fix Evaluation

- **True‑stuck predicate:** `engineTick` now computes `node.stuckScore = calmFactor * pressureFactor` where `calmFactor = max(0, 1 - speed)` and `pressureFactor = min(1, lastCorrectionMag / 2)`; dragging or fixed nodes force the score to zero (`src/physics/engine/engineTick.ts:140-206`). This requires both low speed and non‑trivial constraint pressure before any injector wakes, so passive crystals no longer trigger a heartbeat.
- **Cooldown enforcement:** Each injector checks `node.lastMicroSlipMs` and refuses to fire if the node has run a micro-slip within the last second. `staticFrictionBypass`, `lowForceStagnationEscape`, and `edgeShearStagnationEscape` (`src/physics/engine/velocity/*.ts`: lines ~70-175) all use the same 1.0 s gate, update the timestamp when they do fire, and additionally gate on `stuckScore` before modifying velocities. That rails the previous frame‑forever “heartbeat”.
- **HUD metrics:** `CanvasOverlays` now surfaces `Fires/Sec`, `Stuck Score`, and injector names (`src/playground/components/CanvasOverlays.tsx:330-470`), while `Stats`/`physicsHud` aggregate `stuckScoreAvg`, `microSlipCount`, and `microSlipFiresPerSec`. This gives the team immediate feedback on whether the predicate/cooldown are working.

## 3. Hub Classification & Degrade Law Evaluation

- **Continuous hub strength:** Each tick recomputes `hubStrength` via `smoothstep((deg-2)/(6-2))` and then blends it toward the new value (`engineTick.ts:140-175`). The same scalar hoses pre-roll spring scaling, null-force bias, and the spacing correction gate so there’s no abrupt switch at `degree >= 3`. Hubs still log flips for diagnostics, but the physics always sees a smoothed value.
- **Continuous degrade policy:** Raw load (node+link counts) is mapped to `rawDegrade` and blended via `degradeLerp` before being used, so `degradeLevel` now evolves continuously (`engineTick.ts:584-620`). That drives `motionPolicy.degradeScalar`, which:
  * adjusts `pairStride`/`spacingGate` so spacing stiffness stays proportional to the number of skipped checks;
  * scales triangle strength via `(1 - policy.degradeScalar)` inside `applyTriangleAreaConstraints` (`src/physics/engine/constraints.ts:420-470`);
  * biases spacing corrections by `pairStride` in `applySpacingConstraints` (`src/physics/engine/constraints.ts:250-315`).
There are no longer hard `perfMode` gates that turn constraints on/off; instead the scalar gracefully fades them out, preventing “law pops”.
- **HUD diagnostics:** `CanvasOverlays` shows `Hub Flips`, `Degrade Flips`, and `Degrade Level` percentages, so you can verify continuity in real time (`src/playground/components/CanvasOverlays.tsx:388-470`). The stats object also counts flips for the forensic dashboard (`src/physics/engine/stats.ts`).

## 4. Verdict
- The micro-slip “heartbeat” fix now enforces the guarded stuck predicate plus per-node cooldowns described in the forensic plan, with HUD instrumentation verifying the new invariants. The injectors respect the same stuck/cooldown rules and only modify velocities when both pressure and cadence justify it.
- The hub/degrade rework keeps all hubs and degrade levels continuous: `hubStrength` is smooth, pair stride compensation preserves stiffness, and triangle constraints always run with strength scaled by the degrade scalar instead of being gated by `perfMode`. HUD metrics make these transitions visible so regressions would be obvious.

## 5. Suggested follow-ups
1. If you still see spikes, log `stats.injectors.lastInjector` (already stored) to see which injector drove the heartbeat despite the cooldown.
2. Validate that high degrade levels also log `[Degrade] reason=OVERLOAD` (the scheduler already emits this per `engineTick.ts:796-810`) so you can correlate HUD flop counts with the actual degrade transition.
