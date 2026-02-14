# Welcome2 Ellipsis Decay Step 2

Date: 2026-02-14

## Update
- Changed back-step ellipsis decay from per-1-char to per-2-char step.

## New Decay Behavior
- Landing: `...`
- After +2 typed chars: `..`
- After +4 typed chars: `.`
- After +6 typed chars: hidden

## Implementation
- File: `src/screens/Welcome2.tsx`
- Added constants:
  - `BACKSTEP_ELLIPSIS_START_DOTS = 3`
  - `BACKSTEP_ELLIPSIS_CHARS_PER_DOT_STEP = 2`
- Dot count formula:
  - `dotStepsConsumed = floor(charsSinceLanding / BACKSTEP_ELLIPSIS_CHARS_PER_DOT_STEP)`
  - `dotCount = max(0, BACKSTEP_ELLIPSIS_START_DOTS - dotStepsConsumed)`

## Notes
- Ellipsis remains visual-only and deterministic from `visibleCharCount`.
- No changes to timeline build or cadence schedule.

## Verification
- `npm run build` passed.
