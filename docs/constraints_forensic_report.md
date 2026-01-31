# Constraints Forensic Report

## Summary
- scoped review of `src/physics/engine/constraints.ts` revealed a structural issue that prevented TypeScript from parsing the module (`TS1128` at line 431). Removing the stray brace keeps `applyPairLogic` open until the `return true` and lets `applySpacingConstraints` remain intact.
- A follow-up build (`npm run build`) still fails because `tsc` enforces `noUnusedLocals`/`noUnusedParameters` across several modules; `constraints.ts` alone reports `timeScale` and `timeScaleMultiplier` as unused on lines 42 and 196.

## Findings
1. **Premature helper closure**
   - `applyPairLogic` closed after the soft-zone math block (line ~264), leaving the rest of the helper functions and the body of `applySpacingConstraints` outside of it.
   - With the helper closed early, `applySpacingConstraints` also closed before line 430 and TypeScript emitted `TS1128: Declaration or statement expected` on the `};` right before `applyTriangleAreaConstraints`.
   - Removing the stray `}` keeps the helper body intact, so the `return true`/`passStats` logic remains inside the helper and the outer `applySpacingConstraints` can be closed once at the end.

2. **Unused-local diagnostics after parsing succeeds**
   - `src/physics/engine/constraints.ts:42` and `:196` report `TS6133` for `timeScale` and `timeScaleMultiplier`. These names are no longer referenced anywhere in the file, so they currently break `npm run build`.
   - Once the module parses, `tsc` also flags existing issues across the physics layer (summaries below).

## `npm run build` output after the brace fix
```
src/physics/engine/constraints.ts(42,11): error TS6133: 'timeScale' is declared but its value is never read.
src/physics/engine/constraints.ts(196,5): error TS6133: 'timeScaleMultiplier' is declared but its value is never read.
src/physics/engine/corrections.ts(153,13): error TS6133: 'signFlip' is declared but its value is never read.
src/physics/engine/dtPolicy.ts(28,13): error TS6133: 'lastDtMs' is declared but its value is never read.
src/physics/engine/velocity/baseIntegration.ts(16,5): error TS6133: 'dt' is declared but its value is never read.
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

## Next steps
1. Inline or remove the unused `timeScale`/`timeScaleMultiplier` helpers (or reintroduce their consumers) so `constraints.ts` can pass `tsc`.
2. Investigate the force layer's redeclaration/undefined-variable errors; they predate this change but are now blocking the release build.
