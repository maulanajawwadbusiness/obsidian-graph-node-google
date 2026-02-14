# Welcome2 Seek Run 1 - Hook Foundation

Date: 2026-02-14

## Scope
- Added virtual-time seek foundation in `useTypedTimeline`.
- No Welcome2 UI behavior changes in this run.

## Changes
- Extended hook return type with `seekToMs(ms)`.
- Added playhead refs for deterministic elapsed-time seeking:
  - `startTimeMsRef`
  - `offsetMsRef`
  - `elapsedMsRef`
  - `seekEpochRef`
- Updated elapsed model to:
  - `elapsed = clamp((now - start) + offset, 0..totalMs)`
- Added seek-safe monotonic guard:
  - Backward visible-count movement is allowed only when caused by explicit seek epoch change.

## Determinism Notes
- If `seekToMs` is never called, runtime behavior follows the same timeline schedule as before.
- Timeline build logic and cadence config were not changed.

## Verification
- `npm run build` passed.

## Risk
- Low. Single hook consumer path and no cadence/timeline generation changes.
