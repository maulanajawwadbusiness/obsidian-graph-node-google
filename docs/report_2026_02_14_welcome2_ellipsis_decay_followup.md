# Welcome2 Ellipsis Decay Followup

Date: 2026-02-14

## Goal
- Make back-step ellipsis (`...`) decay immediately as typing resumes, so it does not remain static.

## Changes
- File: `src/screens/Welcome2.tsx`

1. Added landing progress ref:
   - `backStepLandingStartCharCountRef`
   - Stores char count at the moment of back-step landing.

2. Kept existing sentence tracking ref:
   - `backStepLandingSentenceIdxRef`

3. Added progressive ellipsis computation:
   - `charsSinceLanding = max(0, visibleCharCount - landingStartCharCount)`
   - `dotCount = max(0, 3 - charsSinceLanding)`
   - Rendered ellipsis text becomes:
     - `...` at landing
     - `..` after 1 newly typed char
     - `.` after 2 newly typed chars
     - empty after 3 newly typed chars

4. Added cleanup effect:
   - Clears back-step ellipsis refs automatically when ellipsis reaches empty or context no longer matches.

5. Reset rules:
   - `restartCurrentSentence()` clears ellipsis refs.
   - `finishCurrentSentence()` clears ellipsis refs.
   - `goBackOneSentence()` sets both landing sentence and landing char refs.

## Behavior Notes
- Ellipsis remains visual-only and does not modify timeline events or cadence.
- No-click path remains unchanged.

## Verification
- `npm run build` passed.

## Manual Check List
1. Double click `[<-]` to back-step: starts with `...`.
2. As typing adds first char: changes to `..`.
3. As typing adds second char: changes to `.`.
4. As typing adds third char: disappears.
5. Single restart `[<-]` and `[->]` finish paths show no stale ellipsis.
