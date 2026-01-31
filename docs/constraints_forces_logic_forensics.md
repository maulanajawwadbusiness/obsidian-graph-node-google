# Constraints & Forces Logic Forensics

## Summary
- Per the current TypeScript build, both `src/physics/engine/constraints.ts` and `src/physics/forces.ts` still have structural or hygiene problems that prevent `npm run build` from succeeding. Before modifying behavior, it is worth acknowledging that the constraint logic now parses but retains unused temporaries while the force layer still contains duplicated scaffolding and undefined symbols.
- The report below documents the strongest-looking code blocks, the weak spots identified during the review, and the diagnostic evidence from the last `npm run build`.

## Constraints Logic Review (`src/physics/engine/constraints.ts`)
* **Edge relaxation** (lines 28‑181) now runs a deterministic rotation through `engine.links` and includes hand-damping before pushing corrections into the accumulator. The helper enforces `degree > 1` before storing corrections and maintains history (`prevX/prevY`) so the solver stays stable when nodes are dragged.
* **Spacing constraints** (lines 184‑579) use a soft/hard zone boundary and a hot-pair priority pass. The helper `applyPairLogic` has a deterministic overlap shuffle, hub relief scaling via `computeHubScalar`, and a `return true` signal preserved in the current implementation. The hot pair pass (lines 348‑384) ensures frequently violating pairs get extra coverage and cleans itself up correctly.
* **Triangle area springs** continue to guard against degeneracy (`currentArea < 0.1`) and clamp corrections per-frame. The area pass logs degeneracy pressure (`stats.degenerateTriangleCount`) and only nudges vertices when the altitude vector is well-formed.
* **Outstanding concerns**:
  - `applyEdgeRelaxation` now declares `const timeScale = dt * 60.0` even though `timeScale` is unused, and `applySpacingConstraints` still accepts a `timeScaleMultiplier` argument that is never consumed (lines 42 and 196). The unused locals trigger `TS6133` errors (`'timeScale' is declared but its value is never read` and `'timeScaleMultiplier' is declared but its value is never read`), so the logic currently cannot compile cleanly.
  - Because the spacing helper returns early for `d >= D_soft`, there is little coverage for ultra-close pairs unless they were already hot, so the hot set must catch every offender or the accumulation may consistently skip strong corrections.

## Forces Logic Review (`src/physics/forces.ts`)
* The latter part of `applyRepulsion` (lines 204‑296) contains a coherent implementation: deterministic overlap scattering, softening radius, early-expansion density boost, clamp tracking, and pair-stride skipping, all feeding directly into node force updates. This is the version that should keep physics consistent when invoked.
* **Critical blockers** in the top portion of `applyRepulsion`:
  - There are **multiple** `const applyPair` declarations (lines 30‑157 and 204‑286). TypeScript immediately rejects the module with `TS2451: Cannot redeclare block-scoped variable 'applyPair'`.
  - `maxDistSq` is referenced in those early fragments (`if (d2 < maxDistSq)` at lines 50, 120, 222) but never declared, so the build also fails with repeated `TS2304: Cannot find name 'maxDistSq'`.
  - The first block destructures `repulsionDistanceMax` but never uses it (line 18) and declares unused locals such as `repulsionScale`, `effectiveD`, and `densityBoost` (lines 60‑149), so the diagnostics also include a slew of `TS6133`.
* The collision, springs, center gravity, and boundary force helpers appear structurally sound, though their correctness depends on the repulsion pass actually compiling first.

## Diagnostics (`npm run build`)
```
src/physics/engine/constraints.ts(42,11): error TS6133: 'timeScale' is declared but its value is never read.
src/physics/engine/constraints.ts(196,5): error TS6133: 'timeScaleMultiplier' is declared but its value is never read.
src/physics/forces.ts(20,9): error TS6133: 'repulsionDistanceMax' is declared but its value is never read.
src/physics/forces.ts(31,11): error TS2451: Cannot redeclare block-scoped variable 'applyPair'.
src/physics/forces.ts(50,18): error TS2304: Cannot find name 'maxDistSq'.
src/physics/forces.ts(60,17): error TS6133: 'repulsionScale' is declared but its value is never read.
src/physics/forces.ts(75,19): error TS6133: 'effectiveD' is declared but its value is never read.
src/physics/forces.ts(103,11): error TS2451: Cannot redeclare block-scoped variable 'applyPair'.
src/physics/forces.ts(120,18): error TS2304: Cannot find name 'maxDistSq'.
src/physics/forces.ts(138,17): error TS6133: 'densityBoost' is declared but its value is never read.
src/physics/forces.ts(142,17): error TS6133: 'repulsionScale' is declared but its value is never read.
src/physics/forces.ts(149,19): error TS6133: 'effectiveD' is declared but its value is never read.
src/physics/forces.ts(204,11): error TS2451: Cannot redeclare block-scoped variable 'applyPair'.
src/physics/forces.ts(222,18): error TS2304: Cannot find name 'maxDistSq'.
```

## Next Steps
1. Remove the vestigial placeholder fragments near the start of `applyRepulsion` so only the working `applyPair` remains and declare the intended `maxDistSq` (probably derived from `repulsionDistanceMax` squared).  
2. Either use or drop the unused `timeScale`/`timeScaleMultiplier` locals in `constraints.ts` so the module compiles cleanly; once those cleanups are in place, rerun `npm run build` to make sure no further logic blockers remain.  
3. When updating the forces pass, verify that the densification/dither logic still matches the interaction doctrine and add targeted tests if possible to protect against regressions before re-enabling the build.
