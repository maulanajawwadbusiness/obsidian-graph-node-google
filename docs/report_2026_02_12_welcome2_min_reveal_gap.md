# Welcome2 Min Reveal Gap Patch

Date: 2026-02-12
Branch: wire-onboarding-screen
Base commit: 524f332

## Scope

Applied a single-file timing hardening in `src/screens/welcome2Timeline.ts`.

## Changes

1. Added `MIN_REVEAL_GAP_MS = 28` near timeline constants.
2. In the non-newline path of `buildWelcome2Timeline`, enforced:
   - `totalGapMs = charDelayMs + event.pauseAfterMs`
   - if `totalGapMs < MIN_REVEAL_GAP_MS`, increase `charDelayMs` by the exact difference.

## What Was Kept Intact

- Semantic pause placement remains boundary-only (`semanticPauseByIndex`).
- Newline and double-newline branch logic is unchanged.
- `useTypedTimeline` and `Welcome2` are unchanged.
- Timeline progression logic and monotonic event timing contract are unchanged, aside from raising too-small gaps to the minimum threshold.

## Expected Effect

- Reduces ultra-tight reveal gaps that can cause micro-bursts.
- Leaves existing long boundary pauses (semantic/mechanical) effectively unchanged.
