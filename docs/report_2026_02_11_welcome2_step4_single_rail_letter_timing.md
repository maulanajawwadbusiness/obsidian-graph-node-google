# Welcome2 Step 4 Single-Rail Letter Timing Report

Date: 2026-02-11

## Goal
- Lock letters/digits to one stable baseline delay bucket.
- Keep all breathing on boundaries only.

## Expected Letter Delay
- `expectedLetterDelay = Math.max(MIN_LETTER_DIGIT_DELAY_MS, clampMs(tunedCadence.baseCharMs))`
- With current tuned cadence (`baseCharMs=42`), expected value is:
  - `expectedLetterDelay = 42ms`

## Mechanical Timing Buckets
- Letters/digits: fixed `expectedLetterDelay` (42ms)
- Spaces: fixed `expectedSpaceDelay` (14ms)
- Punctuation: fixed `expectedPunctDelay` (42ms)
- Newlines: handled by newline branch split logic

No per-letter semantic or per-letter variable math is applied.

## Debug Proof Slice (`debugCadence=1`)

### Letter stream sample (heavy-word neighborhood)
- `79 i letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `80 n letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `81 t letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `82 u letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `83 i letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `84 t letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `85 i letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `86 v letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`
- `87 e letter charDelayMs=42 semanticPauseMs=0 pauseReason=base`

### Boundary breathing sample
- `78 <space> space charDelayMs=14 semanticPauseMs=14 pauseReason=space`
- `88 <space> space charDelayMs=14 semanticPauseMs=86 pauseReason=space`
- `48 . punct charDelayMs=42 semanticPauseMs=0 pauseReason=marker`
- `49 \\n lineBreak charDelayMs=40 semanticPauseMs=0 pauseReason=lineBreak`

## Letter Bucket Stats
- letter/digit `charDelayMs`:
  - min: 42
  - p50: 42
  - p95: 42
  - max: 42

This confirms a single-rail letter bucket.

## rAF/Rounding Safety Note
- Keeping letter delays in one fixed bucket reduces frame-threshold jitter sensitivity.
- With integer elapsed time (`Math.round`) and rAF cadence, constant per-letter targets are less prone to micro-staccato than mixed per-letter delay values.
