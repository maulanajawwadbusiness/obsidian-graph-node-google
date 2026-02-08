# Welcome2 Semantic Cadence Implementation Report
Date: 2026-02-08
Scope: Semantic cadence layer for manifesto typing (heavy words plus sentence landings)

## 1) Objective
The goal of this pass is to remove linear tick-tick typing feel by adding a deterministic semantic layer on top of existing cadence rules. This layer makes specific words and sentence endings carry more writing weight while preserving existing marker, punctuation, newline, and paragraph behavior.

This implementation does not change:
- typing engine (`useTypedTimeline`)
- cursor component (`TypingCursor`)
- Welcome2 layout
- marker grammar or manifesto text

## 2) Files Changed
1. `src/config/onboardingCadence.ts`
2. `src/screens/welcome2Timeline.ts`

No other files were modified for this feature.

## 3) Cadence Config API Changes
`CadenceConfig` now includes an optional semantic section:

```ts
semantic?: {
  heavyWords: string[];
  heavyWordMinLength: number;
  heavyWordTailChars: number;
  heavyWordMaxMultiplier: number;
  landingTailChars: number;
  landingMaxMultiplier: number;
};
```

### Normal preset semantic defaults
```ts
semantic: {
  heavyWords: [
    'intuitive',
    'knowledge',
    'process',
    'information',
    'intuitively',
    'medium',
  ],
  heavyWordMinLength: 8,
  heavyWordTailChars: 3,
  heavyWordMaxMultiplier: 1.5,
  landingTailChars: 3,
  landingMaxMultiplier: 1.4,
}
```

### Preset and speed behavior
- `fast` and `slow` still derive from `normal` timing values.
- Semantic settings are preserved for all presets.
- `applySpeed(...)` preserves semantic settings (it scales ms fields only).
- `heavyWords` is copied to avoid shared-array mutation between presets.

## 4) Timeline Builder Changes
All semantic timing logic is implemented in `src/screens/welcome2Timeline.ts` and stays pure and deterministic.

### Added types and helpers
- `EmphasisMeta`
  - `heavyDistanceFromEnd?: number`
  - `landingRank?: number`
- `isWordChar(char)` for `[A-Za-z0-9]` word parsing
- `mergeEmphasisMeta(...)` to merge multiple emphasis tags per char index
- `analyzeEmphasis(renderText, semantic)` pre-pass
- `getSemanticMultiplier(meta, semantic)` multiplier resolver with clamp

### Emphasis pre-pass (`analyzeEmphasis`)
Runs on marker-stripped `renderText` so indices align with timeline events.

#### Heavy-word tagging
- Walks text and extracts words using `[A-Za-z0-9]` boundaries.
- A word is heavy if:
  - length >= `heavyWordMinLength`, or
  - lowercase word is in `heavyWords` set.
- Marks the last `heavyWordTailChars` chars of each heavy word:
  - distance `0` = final char
  - distance `1` = second final
  - distance `2` = third final

#### Sentence-landing tagging
- Finds each `.` and `?`.
- Scans left, skipping spaces and newlines.
- Marks up to `landingTailChars` non-space chars before punctuation:
  - rank `0` = closest to punctuation
  - rank `1` = previous
  - rank `2` = previous

#### Merge behavior
If one char gets multiple tags:
- keep smallest `heavyDistanceFromEnd`
- keep smallest `landingRank`
This keeps strongest emphasis for each category.

## 5) Per-Character Timing Application
In the main timeline loop:
- Base char delay is still computed by existing class rules.
- Semantic multiplier is applied only for `letter` and `digit` chars.
- `space`, `punct`, and `lineBreak` do not receive semantic char-level scaling.

### Multiplier tables
Heavy tail:
- distance 0: `x1.5`
- distance 1: `x1.3`
- distance 2: `x1.15`

Landing tail:
- rank 0: `x1.4`
- rank 1: `x1.2`
- rank 2: `x1.1`

Combined:
- multiply both when both apply on same char
- clamp to `min(heavyWordMaxMultiplier * landingMaxMultiplier, 1.9)`

Final char delay for letters/digits:
```ts
charDelayMs = round(baseDelayMs * semanticMultiplier)
```

## 6) What Was Intentionally Preserved
The following behaviors remain unchanged:
- marker parsing and marker override priority (`{p=...}`)
- malformed marker fallback behavior
- punctuation pauseAfter rules
- newline split behavior and newline tuning constants
- double newline cluster mechanics and paragraph pause logic
- marker vs paragraph anti-mush rule
- deterministic accumulation model (`events[i].tMs` from monotonic `currentTimeMs`)

## 7) Determinism and Performance Notes
- The emphasis map is built once per timeline build from stable inputs.
- No randomness, no frame-time dependency, no async side effects.
- Runtime complexity remains linear over text length.
- Hook metrics and debug instrumentation continue to operate on unchanged event model.

## 8) Tuning Knobs (Current Control Points)
Primary semantic knobs in config:
- `heavyWords`
- `heavyWordMinLength`
- `heavyWordTailChars`
- `heavyWordMaxMultiplier`
- `landingTailChars`
- `landingMaxMultiplier`

Existing newline-specific knobs still live in timeline builder:
- `NEWLINE_POST_MIN_MS`
- `NEWLINE_POST_MAX_FRACTION`
- `NEWLINE_PREWAIT_MULTIPLIER`
- `DOUBLE_NEWLINE_MECHANICAL_MULTIPLIER`

## 9) Manual Validation Checklist
1. Confirm heavy words feel weighted at last 2-3 letters:
   - intuitive, knowledge, process, information, intuitively, medium.
2. Confirm sentence endings decelerate before `.` and `?`.
3. Confirm marker and punctuation pauses still land as before.
4. Confirm newline and paragraph behavior remains unchanged from prior tuning.
5. Optional: run with `?debugType=1` and verify deterministic progression (no backward char count).

## 10) Summary
This pass adds a semantic cadence layer that gives words and sentence endings intentional weight without changing the rendering engine or event loop architecture. It is deterministic, configurable from one place, and compatible with existing authored markers and newline tuning.
