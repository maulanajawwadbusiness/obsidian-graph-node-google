# Welcome2 Rich Cadence Tuning Pass

Date: 2026-02-07
Scope: reduce linear feel and introduce richer, intentful breathing in manifesto typing.

## Files Changed

- `src/config/onboardingCadence.ts`
- `src/screens/welcome2ManifestoText.ts`

## Cadence Rebase

Normal preset is now the primary authored profile:

- `baseCharMs: 42`
- `spaceMs: 14`
- `commaPauseMs: 220`
- `periodPauseMs: 480`
- `questionPauseMs: 520`
- `newlinePauseMs: 420`
- `paragraphPauseMs: 1000`
- `markerPauseDefaultMs: 450`
- `endHoldMs: 900`
- `speedMultiplier: 1.0`

Why:
- Non-zero `spaceMs` breaks conveyor-belt pacing between words.
- Heavier punctuation and newline hierarchy creates clear micro-breath and landing behavior.
- Longer paragraph and end-hold pauses reinforce rhetorical weight and silence.

## Preset Consistency

`fast` and `slow` are now derived from `normal` via ratio scaling, keeping timing relationships consistent:

- `fast`: `0.85x`
- `slow`: `1.25x`

This avoids drift between presets and keeps future tuning centralized.

## Marker Density Tweak

In `welcome2ManifestoText.ts`:

- Changed:
  - `...2 am.{p=220}` -> `...2 am.{p=260}`
- Removed:
  - `{p=220}` after `We have been reading text for more than 50 years.`
- Kept:
  - `{p=900}` after `...not the most intuitive form of knowledge.`
  - `{p=900}` after `...natural nerve in our thought.`

Why:
- Reduces repetitive marker cadence pattern.
- Lets punctuation and cadence policy carry one sentence naturally.
- Keeps two intentional deep breaths for meaning pivots.

## Feel Outcome (Target)

- Slower but still sharp.
- Better word separation and phrase intention.
- Sentence endings land more clearly.
- Paragraph transitions feel like deliberate inhale, not linear flow.

## Verification Notes

- Typing engine, timeline algorithm, cursor, and instrumentation logic were not changed.
- Debug metrics path (`?debugType=1`) remains available.
- Build check passed (`npm run build`).
