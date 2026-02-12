# Welcome2 Step 3 Boundary-Only Semantic Cadence

Date: 2026-02-11

## Scope
- File changed: `src/screens/welcome2Timeline.ts`
- Goal: remove all per-letter semantic delays and keep semantic rhythm on boundaries only.

## Changes
- Removed heavy envelope path and related constants/helpers:
  - `HEAVY_ENVELOPE_FRACTION`
  - `MAX_ENVELOPE_CHARS`
  - `MAX_EXTRA_PER_CHAR_MS`
  - `applyHeavyWordEnvelope(...)`
  - `extraDelayByIndex` semantic flow
- Restored heavy semantic budget to boundaries fully:
  - heavy words now add full `heavyWordEndExtraPauseMs` to boundary index.
- Kept semantic boundary placement:
  - `wordEndPauseMs` on word boundary
  - `heavyWordEndExtraPauseMs` on heavy-word boundary
  - `sentenceLandingExtraPauseMs` on punctuation boundary
- Kept mechanical timing unchanged:
  - `getPauseForChar(...)`
  - newline and paragraph branch behavior

## Timing Contract After Change
- `charDelayMs`:
  - base delay only (`baseCharMs` / `spaceMs`) plus letter/digit min guard
  - no semantic extras
- `pauseAfterMs`:
  - mechanical pause + `semanticPauseByIndex[i]` at boundaries
- Invariant note:
  - semantic cadence must never be reintroduced into per-letter `charDelayMs`.
  - all semantic intent must flow through boundary `semanticPauseByIndex` only.

## Debug Cadence Logging
- Under `debugCadence=1`, samples now log:
  - `charIndex`, `char`, `class`, `deltaMs`, `semanticPauseMs`, `pauseReason`
- Added:
  - heavy-word-centered slice (includes following boundary)
  - sentence punctuation slice

## Verification
- `npm run build` passed.
- Static scan confirms no per-letter semantic delay path remains.
