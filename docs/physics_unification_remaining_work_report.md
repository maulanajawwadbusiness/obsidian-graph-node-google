# Physics Unification Remaining Work Report

## Context & Readback
- Requested prior reports `physics_unification_run1_report.md`, `physics_unification_run2_report.md`, `physics_unification_run3_report.md`, and `physics_unification_final_audit.md` were not found in the repository at time of work. (No files matched in `docs/` or repo root.)

## Task A: Gate Tombstones (Energy → MotionPolicy)
**MotionPolicy ramps (temperature = energy envelope):**
- `earlyExpansion = smoothstep(0.72, 0.9, temperature)`
- `expansion = smoothstep(0.55, 0.75, temperature)`
- `diffusion = smoothstep(0.05, 0.2, temperature)`
- `hubConstraintRelief = earlyExpansion`
- `hubInertiaBlend = 1 - smoothstep(0.7, 0.88, temperature)`
- `denseBypass = earlyExpansion`
- `microSlip = earlyExpansion`
- `carrierFlow = expansion`
- `angleResistanceRelief = expansion`

**Tombstones (file/function → old gate → new MotionPolicy param/formula):**
- `constraints.ts/applySpacingConstraints` → `energy > 0.85 && degree>=3` hub skip → `hubConstraintRelief` ramp, correction scaled by `1 - hubConstraintRelief` (escape window still full skip).
- `constraints.ts/applyTriangleAreaConstraints` → `energy > 0.85 && degree>=3` hub skip → `hubConstraintRelief` ramp, correction scaled by `1 - hubConstraintRelief` (escape window still full skip).
- `constraints.ts/applySafetyClamp` → `energy > 0.85 && degree>=3` hub skip → `hubConstraintRelief` ramp, correction scaled by `1 - hubConstraintRelief`.
- `corrections.ts/applyCorrectionsWithDiffusion` → `energy > 0.1` diffusion gate → `diffusion` ramp; diffusion share multiplied by `diffusion`.
- `corrections.ts/applyCorrectionsWithDiffusion` → `energy < 0.8` hub inertia → `hubInertiaBlend` ramp; hub inertia scaled by `hubInertiaBlend`.
- `velocity/expansionResistance.ts` → `energy > 0.7` enable + `energy > 0.85` dense bypass → `expansion` ramp for pass strength, `denseBypass` ramp for bypass.
- `velocity/hubVelocityScaling.ts` → `energy > 0.85` dense bypass → `denseBypass` ramp, hub damping blended via `1 - denseBypass`.
- `velocity/carrierFlow.ts` → `energy > 0.7` + fade → `carrierFlow` ramp (smooth strength).
- `velocity/angleResistance.ts` → `energy > 0.7` expansion disable + `energy > 0.85` hub skip → `angleResistanceRelief` ramp for zone scaling, `hubConstraintRelief` for hub force scale.
- `velocity/denseCoreVelocityUnlock.ts` → `energy > 0.85` → `microSlip` ramp.
- `velocity/staticFrictionBypass.ts` → `energy > 0.85` → `microSlip` ramp.
- `velocity/angularVelocityDecoherence.ts` → `energy > 0.85` → `earlyExpansion` ramp.
- `velocity/localPhaseDiffusion.ts` → `energy > 0.85` → `earlyExpansion` ramp.
- `velocity/edgeShearStagnationEscape.ts` → `energy > 0.85` → `earlyExpansion` ramp.
- `velocity/lowForceStagnationEscape.ts` → `energy > 0.85` → `earlyExpansion` ramp.
- `velocity/denseCoreInertiaRelaxation.ts` → `energy > 0.85` → `earlyExpansion` ramp.

## Task B: Physics HUD (Complete)
**Integration:**
- Reused the top-left debug panel to host a dev-only Physics HUD + harness controls.
- Panel captures pointer + wheel events to avoid leaking input into the canvas.

**HUD Fields (dev-only):**
- Nodes, Links
- FPS (smoothed)
- Degrade level + % time degraded (last 5s)
- Settle state (moving/cooling/microkill/sleep) + last settle ms
- JitterAvg (last 1s)
- PBD correction sum per frame
- Conflict% (frames with correction opposing velocity, last 5s)
- Energy proxy (avg v²)

**Harness Controls:**
- Preset spawn buttons: N=5/20/60/250/500 (fixed seed)
- Scenario buttons: “Settle Test”, “Drag Test” (with instructions + highlighted dot)
- Scoreboard: persists results per N, includes ratio vs N=5

**HUD Screenshot Description:**
- Debug panel now includes a “Physics HUD” section at the top with the metrics list, followed by harness buttons and a scoreboard table. (No screenshot captured; browser tools are forbidden in this environment.)

## Task C: Edge-Case Assault Testing (Documented)
**Status:** Manual execution is pending (non-interactive environment; no in-app testing possible here). Below are the intended test notes + expected HUD observation targets for Maulana.

| Case | Visual Result | HUD Metrics | Continuity | Notes / Risks | Suggested Mitigation |
| --- | --- | --- | --- | --- | --- |
| 1) dtHuge / tab switch / window blur | **Not run** (expect stutter + no syrup) | Degrade% spike, settle remains stable | Should remain continuous | Risk: delayed wake after blur | Confirm `dtHuge` drop debt, ensure wake on blur. |
| 2) resize storms (rect 0x0) | **Not run** (expect no blank map) | FPS stable after resize | Continuous | Risk: surface reset; hover stale | Verify zero-size guard + surface hysteresis. |
| 3) DPR change / monitor swap | **Not run** (expect crisp + no flicker) | FPS stable, jitter unchanged | Continuous | Risk: hover mismatch during DPR flap | Validate 4-frame DPR debounce. |
| 4) rapid zoom/pan during settle | **Not run** (expect smooth camera + stable settle state) | JitterAvg stable | Continuous | Risk: jitter spikes in dense cores | Watch PBD corr spikes; adjust if needed. |
| 5) drag spam (pointercancel/lostcapture/blur) | **Not run** (expect dot snaps to hand) | Conflict% should stay low | Continuous | Risk: stuck drag + locked input | Verify release on blur/cancel. |
| 6) dense clusters + high-degree hubs | **Not run** (expect no hard flip) | Energy proxy decays smoothly | Continuous | Risk: hub skip too strong | Tune `hubConstraintRelief` ramps if needed. |
| 7) near-degenerate triangles / tight overlaps | **Not run** (expect no explosion) | PBD corr/frame spikes but bounded | Continuous | Risk: constraint jitter | Adjust triangle softening if needed. |
| 8) degrade transitions 0↔1↔2 while dragging | **Not run** (expect hand authority) | Degrade% spikes; conflict% low | Continuous | Risk: law feels mushy | Ensure degrade changes cadence only. |
| 9) node count growth mid-run (if supported) | **Not run** (expect stable integration) | JitterAvg spikes briefly | Continuous | Risk: warm-start debt mismatch | Ensure warm-start invalidation on topology changes. |

**Future Issues (Ranked):**
1. **Manual assault validation** is still required; prioritize cases 1, 3, 5, 8.
2. **Dense hub relief tuning**: if hubs drift too freely, tighten `hubConstraintRelief` ramp window.
3. **Correction/velocity conflict spikes**: if conflict% climbs during settle, revisit diffusion scaling.
4. **HUD sampling cost** in heavy scenes: monitor for overhead in fatal-density runs.
