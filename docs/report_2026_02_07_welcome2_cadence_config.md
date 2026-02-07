# Welcome2 Cadence Config (Step 1)

Date: 2026-02-07
Scope: Add onboarding typing cadence configuration only. No typing engine wiring, no audio, no behavior changes yet.

## File Added

- `src/config/onboardingCadence.ts`

## Exported API

- `type CadenceConfig`
  - `baseCharMs`
  - `spaceMs`
  - `commaPauseMs`
  - `periodPauseMs`
  - `questionPauseMs`
  - `newlinePauseMs`
  - `paragraphPauseMs`
  - `markerPauseDefaultMs`
  - `endHoldMs`
  - `speedMultiplier`
- `const CADENCE_PRESETS: { fast, normal, slow }`
- `const DEFAULT_CADENCE = CADENCE_PRESETS.normal`
- `function applySpeed(cfg, multiplier)`

## Default Values (normal preset) and Rationale

`DEFAULT_CADENCE` uses `CADENCE_PRESETS.normal`:

- `baseCharMs: 26`
- `spaceMs: 0`
- `commaPauseMs: 65`
- `periodPauseMs: 140`
- `questionPauseMs: 165`
- `newlinePauseMs: 110`
- `paragraphPauseMs: 260`
- `markerPauseDefaultMs: 220`
- `endHoldMs: 420`
- `speedMultiplier: 1.0`

Why this fits tight-sharp cadence:
- Character pace is fast enough to feel precise, not syrupy.
- Space cost is zero to avoid mush between words.
- Punctuation pauses are distinct but bounded.
- Paragraph pause is longer for meaning transition, but still controlled.
- End hold gives a clear finish cue without dragging.

## Presets

- `fast`: aggressive pacing for snappier feel (`speedMultiplier: 0.9`).
- `normal`: baseline authored rhythm (`speedMultiplier: 1.0`).
- `slow`: calmer pacing while preserving punctuation hierarchy (`speedMultiplier: 1.15`).

All presets remain in one module as the single source of tune.

## Priority Rules for Marker and Punctuation Pauses

For future timeline parsing in Welcome2:
1. Explicit marker pause (`{p=###}`) has highest priority at that position.
2. If marker is malformed, use `markerPauseDefaultMs`.
3. If no marker exists, apply punctuation/newline/paragraph rule pauses.

This keeps authored rhythm deterministic and lets manifesto markers override generic punctuation timing.

## applySpeed Helper

- `applySpeed(cfg, multiplier)` returns a derived config with all ms knobs scaled.
- It combines preset speed and runtime multiplier (`cfg.speedMultiplier * multiplier`).
- Invalid multipliers are clamped to `1.0`.
- Scaled ms values are rounded and clamped to `>= 0`.

This supports easy future tuning from one location and makes query-based preset switching possible later without engine rewrites.

## Verification Notes

- Build/typecheck passed after adding the module.
- No Welcome2 behavior changes in this step.
- No audio code, assets, or audio-related config added.
