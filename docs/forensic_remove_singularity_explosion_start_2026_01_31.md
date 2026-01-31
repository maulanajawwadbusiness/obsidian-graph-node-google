# Forensic Report: Remove “Singularity Explosion Start”
**Date:** 2026-01-31
**Subject:** Startup pipeline cleanup + new init strategy (`initStrategy=spread`)

## 1) Start Pipeline Map (Before)
`graph generation -> initial positions -> engine init -> first tick gates -> pre-roll -> impulse -> early expansion gates -> steady-state`

**Observed start-only injectors & locations**
- **Micro-cloud seeding** (symmetry break): `src/playground/graphRandom.ts` (micro-jitter at spawn)
- **Pre-roll phase** (~5 frames): `src/physics/engine/engineTick.ts`, `src/physics/engine/preRollPhase.ts`, `src/physics/engine/velocity/preRollVelocity.ts`, `src/physics/engine/forcePass.ts`
- **Impulse kick**: `src/physics/engine/impulse.ts` (auto-triggered by `engineTick` → `engine.requestImpulse()`)
- **Early-expansion special casing**:
  - Repulsion density boost + dither: `src/physics/forces.ts`
  - Hub softening + dead-zone bypass: `src/physics/forces.ts`
  - Integration ordering + dt skew + force lag: `src/physics/engine/integration.ts`
  - Motion policy ramps: `src/physics/engine/motionPolicy.ts`
  - Constraint hub relief: `src/physics/engine/constraints.ts` (via policy)
  - Carrier flow / drift: `src/physics/engine/velocity/carrierFlow.ts` (via policy)

## 2) Decision (Knife-Cut)
**Chosen:** Option A — **`initStrategy=spread`** as default.
- **Spread seeding**: deterministic disc/spiral placement with minimum separation epsilon.
- **Safety preserved**: still non-zero separation + existing `repulsionMinDistance` guard.
- **Legacy path** preserved behind `initStrategy=legacy` (pre-roll + impulse + early-expansion gates).

## 3) Implementation Changes
### A) New Init Strategy (Default = Spread)
- **Added** `initStrategy: "spread" | "legacy"` to `ForceConfig` and default config.
- **Spread seeding** implementation in `generateRandomGraph`:
  - Deterministic spiral/disc placement
  - Enforced `minSpawnSpacing = 2px` epsilon to avoid true overlap
  - Applied after topology creation so links/roles remain intact

### B) Start-Only Injectors Gated by Strategy
- **Pre-roll** and **impulse** are now gated behind `initStrategy === "legacy"`.
- **Early-expansion special casing** is disabled when strategy is `spread`:
  - Repulsion density boost
  - Hub dead-zone bypass
  - Spring tangential softening & dither
  - Integration order & dt skew
  - Carrier flow ramps (policy driven)

## 4) Why This Is Safe (Singularity Prevention)
- **Minimum spawn separation** (2px) eliminates exact coordinate overlap at t=0.
- **Force-level guard** remains (`repulsionMinDistance` + collision guards), preventing infinite forces even if a pair compresses.
- **No start-only energy injection**, so the map begins stable and “map-like” immediately.

## 5) Verification Notes
- **Manual harness checks requested** (N=5/20/60/250) with no first-frame explosion and no NaNs.
- **IDE browser tools are forbidden**, so no visual capture was performed here.
