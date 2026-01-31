# Forces Forensic Report

## Summary
- `src/physics/forces.ts` is currently unbuildable because the repulsion pass is littered with leftover drafts and duplicate helpers that trip TypeScript before the real logic runs.
- The build log shows redeclaration errors, undefined symbols, and unused locals all originating from the partial fragments inserted near the top of `applyRepulsion`.

## Findings
1. **Duplicate helper definitions block the module** – there are three `const applyPair` declarations inside `applyRepulsion` (around `src/physics/forces.ts:30-157` and again at `:204-286`). Each redeclare triggers `TS2451: Cannot redeclare block-scoped variable 'applyPair'`, so the file never transpiles. The red herrings at lines 30‑160 are clearly draft notes (see the comment stream starting at `src/physics/forces.ts:68`) that need to be removed or consolidated.
2. **`maxDistSq` is referenced but never defined** – the placeholder fragments repeatedly check `if (d2 < maxDistSq)` (at `:50`, `:120`, `:222`), yet there is no declaration anywhere in `forces.ts`, which is why `tsc` reports `TS2304: Cannot find name 'maxDistSq'` three times. Every distance-bound check must either use `repulsionDistanceMax` or compute `(repulsionDistanceMax * repulsionDistanceMax)` before referencing it.
3. **Unused locals from the abandoned draft block** – `repulsionDistanceMax` is destructured from `config` at `src/physics/forces.ts:18-23` but never consumed, and the early draft `applyPair` functions declare `repulsionScale`, `effectiveD`, and `densityBoost` that remain unused because the core logic was never filled in. These trigger `TS6133` warnings (`repulsionScale` @ `:60`, `effectiveD` @ `:75`, `densityBoost` @ `:138`, etc.) and were already highlighted in the failed `npm run build`.

## Build reproduction
```
npm run build
```
The TypeScript phase stops with:

```
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

## Next steps (for later repair)
1. Cull the draft/placeholder helpers so there is exactly one `applyPair` implementation that contains the real repulsion logic.
2. Define the intended maximum distance (`maxDistSq` or similar) before it is referenced, ideally derived from `repulsionDistanceMax`.
3. Either wire up or drop the unused locals (`repulsionDistanceMax`, `repulsionScale`, `effectiveD`, `densityBoost`) so `tsc` stops complaining once the duplicates are gone.
