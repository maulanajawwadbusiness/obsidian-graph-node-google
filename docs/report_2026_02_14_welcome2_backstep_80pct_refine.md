# Welcome2 Back-Step 80 Percent Landing Refinement

Date: 2026-02-14

## Scope
- Refined only back-step landing (`[<-]` double click and back-chain).
- Restart and finish behaviors remain unchanged.

## Changes
- File: `src/screens/Welcome2.tsx`
- Added `BACKSTEP_LAND_RATIO = 0.8`.
- Added `getBackStepLandCharCount(sentenceIdx)`:
  - `start = sentenceStartCharCountByIndex[sentenceIdx]`
  - `endCore = sentenceEndCoreCharCountByIndex[sentenceIdx]`
  - `len = endCore - start`
  - `land = start + max(1, floor(len * 0.8))`
  - clamp to `[start + 1, endCore]` for non-empty sentence.
- Updated `goBackOneSentence()`:
  - now seeks to previous sentence 80 percent char count (not endCore).
  - still uses exact event time (`events[landCharCount - 1].tMs`), no `-1ms`.
- Added temporary visual ellipsis for back-step landings:
  - `showBackStepEllipsis` is true while currently in the back-step target sentence and `visibleCharCount < endCore`.
  - ellipsis disappears automatically once typing catches up to `endCore`.

## Preserved Behavior
- Single click `[<-]` still restarts current sentence with pre-char seek (`startMs - 1`).
- `[->]` still finishes current sentence using soft end.
- No timeline rebuild; all jumps remain via deterministic `seekToMs`.
- Existing manual-seek auto-advance suppression and timer hardening unchanged.

## Verification
- `npm run build` passed.

## Manual Validation Checklist
1. Mid sentence2 single `[<-]` -> restart sentence2 start (first char not pre-visible).
2. Double click `[<-]` -> land around 80 percent of sentence1 and show `...`.
3. After chain timeout, single `[<-]` -> restart current sentence start.
4. Chain clicks step back sentence-by-sentence at around 80 percent.
5. No clicks path preserves normal typing cadence.
