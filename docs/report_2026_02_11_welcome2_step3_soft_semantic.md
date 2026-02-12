# Welcome2 Step 3 Soft Semantic Cadence Report

Date: 2026-02-11

## Goal
- Keep letters/digits mechanically steady.
- Keep semantic meaning on boundaries only.
- Soften boundary breathing so it feels intentional, not abrupt.

## Final Semantic Values
Updated in `src/config/onboardingCadence.ts`:
- `wordEndPauseMs`: 14 (was 27)
- `heavyWordEndExtraPauseMs`: 72 (was 135)
- `sentenceLandingExtraPauseMs`: 135 (was 180)
- `landingTailChars`: 2 (was 3)

## Boundary Category Rules
Implemented in `src/screens/welcome2Timeline.ts` with strict priority:
1. marker boundary: semantic extra = 0
2. sentence landing boundary (`. ? !`): semantic extra = `sentenceLandingExtraPauseMs`
3. heavy word boundary: semantic extra = `wordEndPauseMs + heavyWordEndExtraPauseMs`
4. normal word boundary: semantic extra = `wordEndPauseMs`

No additive 3-way stacking across heavy + landing + marker on the same boundary.

## Semantic Clamp
- Added `MAX_SEMANTIC_BOUNDARY_MS = 220`.
- Applied to semantic extras after category selection.
- Marker boundaries are not semantically boosted (`semantic=0`), so marker pauses remain authored truth.

## Marker + Semantic Interaction
- If marker pause exists at a boundary (`pauseReason: marker`), semantic extra is suppressed to 0.
- Example from EN manifesto first period with `{p=260}`:
  - before: marker 260 + semantic 207 = 467
  - after: marker 260 + semantic 0 = 260

## Before/After Stats (EN manifesto sample)
Computed from current timing model comparison:

- Word boundary semantic pause (`semanticPauseMs` at normal/heavy word boundaries):
  - before: min 27, p50 27, p95 162, max 162
  - after:  min 14, p50 14, p95 86,  max 86

- Sentence punctuation total pause (non-marker, `pauseAfterMs = mechanical + semantic`):
  - before: min 687, p50 687, p95 822, max 822
  - after:  min 615, p50 615, p95 615, max 615

Notes:
- Punctuation totals remain high because `periodPauseMs=480` and `questionPauseMs=520` are mechanical baseline.
- This step only softened semantic extras and stacking rules, not mechanical punctuation pauses.

## Debug Proof
`debugCadence=1` now prints:
- sample rows with `charIndex, char, class, deltaMs, charDelayMs, semanticPauseMs, pauseReason, semanticCategory`
- violation log if any letter/digit has non-zero semantic pause:
  - `[Welcome2Cadence][Violation] semantic pause on letter/digit ...`
- boundary stats buckets:
  - normalWord
  - heavyWord
  - landing
  - punctuation total pause (no marker)

## Invariant Lock
- semantic cadence is boundary-only.
- letters are mechanically timed only.
- no semantic contribution to per-letter `charDelayMs`.
