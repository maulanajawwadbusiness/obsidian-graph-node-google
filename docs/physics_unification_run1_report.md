# Physics Unification Run 1 Report

Date: 2026-01-31

## Scope (Run 1: Steps 1–3)
This run establishes the shared unified motion state plumbing, reconciles PBD position changes back into velocity, and converts the top early-expansion gates into continuous ramps tied to the unified temperature signal.

## 1) Unified Motion State (One-Law Contract)
**What changed**
- Added a single `UnifiedMotionState` type and `computeUnifiedMotionState(...)` to compute per-frame scalars: temperature, density, degree, authority, and budgetScale.
- The unified state is computed once per tick in `runPhysicsTick` and stored on the engine for future use.

**Where**
- `src/physics/engine/unifiedMotionState.ts` (`UnifiedMotionState`, `computeUnifiedMotionState`)
- `src/physics/engine/engineTick.ts` (`computeUnifiedMotionState` call site)

**Why it matches “one law”**
- All continuous motion scalars now derive from a single per-frame state. This prevents fragmented threshold logic and establishes a single source of truth for motion gating.

## 2) Canonical PBD → Velocity Reconciliation
**What changed**
- Added a centralized reconciliation step that converts post-PBD position deltas into velocity updates (`v += dx/dt`).
- Added debugPerf-only instrumentation to log per-frame sums for PBD displacement and reconciliation.

**Where**
- `src/physics/engine/positionVelocityReconcile.ts` (snapshot + reconcile logic)
- `src/physics/engine/engineTick.ts` (integration point + logging)

**Why it matches “one law”**
- Forces, integration, and PBD now share a consistent velocity baseline, eliminating “ghost velocity” that previously prevented settling.
- Drag authority is preserved by skipping reconciliation on fixed and dragged dots.

## 3) Top-Offender Gates → Continuous Ramps (Run 1 only)
**Converted Gates (small, explicit set)**
1) **Early Expansion Gate**
   - **Before**: hard threshold `energy > 0.85`.
   - **After**: continuous ramp `smoothstep(0.7, 0.9, temperature)`.
   - **Where**:
     - `src/physics/engine/velocity/energyGates.ts`
     - Applied in:
       - `applyStaticFrictionBypass` (`src/physics/engine/velocity/staticFrictionBypass.ts`)
       - `applyDenseCoreVelocityDeLocking` (`src/physics/engine/velocity/denseCoreVelocityUnlock.ts`)

2) **Dense-Core Gate**
   - **Before**: hard threshold `localDensity >= 4`.
   - **After**: continuous ramp `smoothstep(threshold - 1, threshold + 1, localDensity)`.
   - **Where**:
     - `src/physics/engine/velocity/energyGates.ts`
     - Applied in:
       - `applyStaticFrictionBypass`
       - `applyDenseCoreVelocityDeLocking`

3) **Hub Lag / Temporal Skew Gate**
   - **Before**: hard threshold `energy > 0.8 / 0.85`.
   - **After**: continuous ramps tied to unified temperature.
   - **Where**:
     - `src/physics/engine/integration.ts` (scaled hub lag filter + dt skew magnitude)

**Why it matches “one law”**
- These changes remove discontinuities in the early-expansion regime, using a single smooth temperature scalar (from unified motion state) to modulate motion.
- No stiffness/force laws were changed, only gating and scaling, preserving the core equation set.

## Debug / Instrumentation
- Added `debugPerf` logging for `pbdDeltaSum` and `vReconAppliedSum` per second to confirm reconciliation magnitude and diagnose settle behavior.

## Risks & Follow-ups (Run 2)
- **Potential over-energize**: If PBD corrections are large, the velocity reconcile can add energy. Monitor and add damping/clamps in Run 2 if needed.
- **Remaining gates**: Other energy/density gates (edge shear, angular decoherence, etc.) remain discrete and should be converted to ramps in Run 2.
- **Throw vs drop**: Release behavior still zeroes velocity; revisit in Run 2 per forensic report guidance.

