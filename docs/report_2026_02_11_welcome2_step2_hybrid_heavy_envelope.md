# Welcome2 Step 2 Hybrid Heavy Envelope Report

Date: 2026-02-11

## Scope
- Keep Step-1 boundary semantics as primary timing law.
- Add small heavy-word ease-out envelope on char delays.
- File changed: `src/screens/welcome2Timeline.ts`

## Canonical Behavior
- Boundary semantic pauses remain primary:
  - `wordEndPauseMs` stays boundary-based for all words.
  - `sentenceLandingExtraPauseMs` stays boundary-based on punctuation.
- Heavy word extra is split:
  - `envelopeBudgetMs = clampMs(heavyWordEndExtraPauseMs * HEAVY_ENVELOPE_FRACTION)`
  - `boundaryHeavyBudgetMs = heavyWordEndExtraPauseMs - envelopeBudgetMs`
  - boundary gets `boundaryHeavyBudgetMs`, envelope gets `envelopeBudgetMs`.

## Envelope Implementation
- Constants:
  - `HEAVY_ENVELOPE_FRACTION = 0.5`
  - `MAX_ENVELOPE_CHARS = 3`
  - `MAX_EXTRA_PER_CHAR_MS = 18`
- Helper:
  - `applyHeavyWordEnvelope(extraDelayByIndex, renderChars, wordEndIndex, envelopeBudgetMs)`
- Distribution:
  - collect last up to 3 word chars ending at heavy word end.
  - weights:
    - 3 chars: `[1, 2, 3]`
    - 2 chars: `[1, 2]`
    - 1 char: `[1]`
  - cap each per-char addition at `MAX_EXTRA_PER_CHAR_MS`.
  - leftover budget from caps is ignored.

## Event Loop Integration
- `event.pauseAfterMs` remains:
  - mechanical pause from `getPauseForChar(...)`
  - plus `semanticPauseByIndex[i]` (boundary semantics).
- `charDelayMs` now includes:
  - base char delay
  - plus `extraDelayByIndex[i]` (heavy envelope only)

## Debug Cadence Output
- Heavy sample now logs per-char:
  - `deltaMs`
  - `extraDelayMs`
  - `semanticPauseMs`
- Also logs the first heavy boundary index and boundary character.

## Verification
- `npm run build` passed.
- Static check confirms sentence landing stayed boundary-only.

## Manual Feel Test
- Must be validated in Windows Chrome at 100 percent zoom.
- Target feel:
  - normal words remain stable and smooth.
  - heavy words get subtle last-letter ease-out plus soft boundary breath.
