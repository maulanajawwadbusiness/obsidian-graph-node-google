# Welcome2 Back-Step End-Core Fix

Date: 2026-02-14

## Problem
- Back-step (`[<-]` double click and chain mode) was landing at previous sentence start.
- Required landing is previous sentence end content point (punctuation visible), not sentence start.

## Changes
- Updated sentence span model in `src/screens/welcome2SentenceSpans.ts`:
  - `sentenceEndCoreCharCountByIndex`: sentence content end (includes terminator and immediate closing quote/paren, excludes trailing whitespace).
  - `sentenceEndSoftCharCountByIndex`: sentence end including trailing spaces/newlines.
- Updated sentence index resolution in `src/screens/Welcome2.tsx`:
  - Current sentence lookup now probes last visible character: `max(0, visibleCharCount - 1)`.
- Updated behavior wiring in `src/screens/Welcome2.tsx`:
  - `[->]` finish uses soft end (`sentenceEndSoftCharCountByIndex`), preserving existing behavior.
  - Back-step (double click and chain) uses previous sentence core end (`sentenceEndCoreCharCountByIndex`).
  - Back-step end-core seek uses exact event time (`events[targetCharCount - 1].tMs`), not `-1ms`.
  - Restart current sentence still uses start pre-char timing (`startMs - 1`) to avoid immediate first-character reveal.

## Safety
- No timeline rebuild. All jumps continue to use `seekToMs`.
- Existing manual-seek auto-advance suppression and timer hardening remain unchanged.

## Verification
- `npm run build` passed.

## Manual Checks To Run
1. Mid sentence2 single click `[<-]`: restart sentence2 start, first char not pre-visible.
2. Then double click `[<-]`: land at sentence1 core end with punctuation visible.
3. Quick chain clicks: step back by core ends for previous sentences, clamp at sentence 0.
4. `[->]` still lands at soft end (includes trailing whitespace/newline).
5. No-click run preserves normal typing cadence.
