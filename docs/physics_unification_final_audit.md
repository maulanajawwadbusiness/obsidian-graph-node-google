# Physics Unification Final Audit

Date: 2026-01-31

## 1) Single-Law Proof (Architecture Audit)
**Authoritative law location**
- Motion law is centralized in `src/physics/engine/motionPolicy.ts` via `computeMotionPolicy(...)` and wired through the tick pipeline as the single source of motion thresholds and interaction parameters.

**Mini-law scan (offenders / debt)**
- **Energy gates outside MotionPolicy**:
  - `constraints.ts`: hub skip gates use `energy > 0.85` (edge relaxation + safety clamp). These gates still rely on hard energy thresholds and are not yet parameterized by MotionPolicy. (Known debt)
  - `corrections.ts`: diffusion uses `energy > 0.1` and hub inertia uses `energy < 0.8`. These are still hard thresholds. (Known debt)
  - `velocity/*`: some early-expansion gates still use `energy > 0.85` or `energy > 0.7` (e.g., carrier flow, angular decoherence, edge shear) even though scale-safe constants are now provided by MotionPolicy. (Known debt)
- **Degrade changes to equations**: None found. Degrade is explicitly limited to cadence/budget only (see `engineTick`).
- **Node-count special behavior**: None found outside perf-mode budgeting (which only affects cadence).

**Fixes applied during audit**
- Added a consolidated conflict metric log to the tick loop (`[PhysicsConflict] corrOpposePct, corrToForce`) to quantify force/correction conflicts without adding new systems.

## 2) Integration Correctness Audit (Math + Ordering)
**Pipeline order**
- Forces → velocity modifiers → integration → constraints/PBD → PBD→V reconcile → settle ladder.
- This ordering is explicitly in `engineTick` and remains consistent with fixed-step doctrine.

**DT usage**
- All integrator updates use the provided `dt` or the per-node `nodeDt` (skew only under debug). No double-dt applications found.
- PBD reconciliation uses `dx / dt` and guards against `dt <= 0`.

**PBD→V reconcile**
- Applied once per tick after constraints/diffusion and before settle ladder.
- Skips fixed and dragged dots, preventing corrupting drag authority.

## 3) Force Sanity Audit (Runaway / Conflict)
**Bounded force checks**
- Per-pass force magnitudes remain bounded by existing caps (repulsion/collision max force, correction budgets, max velocity).
- No new unbounded forces added during audit.

**Conflict metrics (added)**
- `corrOpposePct`: % of dots where correction direction opposes velocity.
- `corrToForce`: correction sum relative to force sum (debug only).

**Conflict verdict**
- Metrics are logged once per second when `debugPerf` is enabled.
- No equation changes were made; only visibility added.

## 4) Scale Sameness Audit (Harness)
**Harness attempt**
- Attempted to run the dev-only harness via `npx ts-node`, but the environment blocked npm registry access (403). Harness results could not be generated in this environment.

**Expected harness procedure**
- Set `window.__PHYSICS_SCALE_HARNESS__ = true` and enable `debugPerf`.
- The harness logs a console table for N=5/20/60/250/500 (settleMs, overshootMax, jitterAvg, pbdCorrectionAvg, corrOpposePct, energyProxy, budgetScale histogram).

**Verdict**
- **Not executed** due to environment restrictions. The harness is wired and ready for manual verification in a dev environment.

## 5) Edge-Case Assault (Knife Safety Rails)
The following cases were **not executed** in this environment. The pipeline wiring and guards remain intact; manual verification is required:
- dtHuge / tab switch
- resize storms
- DPR change
- rapid zoom/pan while settling
- drag start/stop spam and pointercancel
- high-degree hubs + dense clusters
- near-degenerate triangles / tight overlaps
- degrade transitions while dragging
- node count growth mid-run

## 6) Remaining Risks / Follow-ups
Ranked by impact:
1) **Energy gates not yet unified under MotionPolicy** (constraints/corrections/velocity passes). These are explicit mini-law fragments and should be routed through MotionPolicy in a future pass.
2) **Harness verification pending** due to environment limitations; run harness to confirm settleMs ratios and jitter scaling.
3) **Edge-case manual validation** still required (per doctrine) for drag + degrade transitions and dtHuge scenarios.

