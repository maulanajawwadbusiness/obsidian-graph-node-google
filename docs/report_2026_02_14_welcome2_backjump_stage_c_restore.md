# Welcome2 Back-Jump Stage C Restore (80 Percent Cut)

Date: 2026-02-14

## Scope
- Restored missing stage C after two-stage stabilize flow.
- Back-jump now runs A -> B -> C:
  - A: current start hold 200ms
  - B: previous end-core hold 200ms
  - C: seek backward to previous 80 percent cut, then resume normal typing

## Root Issue
- Previous refactor ended at stage B (previous end-core) and never performed final cut seek.

## Changes
- File: `src/screens/Welcome2.tsx`
- Added timeout ref:
  - `stabilizeTimeoutCRef`
- Extended timeout hardening:
  - `clearPendingBackJump()` now cancels A/B/C timers, clears stage, clears cut visuals, and unpauses clock.
- Added stage C cut target computation:
  - `prevStart`, `prevEndCore`, `len`, `cutChar = prevStart + clamp(floor(len*0.8), 1, len)`
  - `cutMs = toSentenceEndTargetMs(cutChar)`
- Stage chain now:
  1. stage `cur_start` + seek A
  2. after 200ms stage `prev_end` + seek B
  3. after next 200ms seek C (backward), clear stage, resume clock

## Optional Visual Ellipsis
- Added cut ellipsis display after stage C landing when `cutChar < prevEndCore`.
- Ellipsis hides automatically once typing catches up to `endCore`.
- Cleared on cancel/finish/unmount via `clearPendingBackJump()`.

## Cursor Behavior
- Cursor blink override during holds remains intact:
  - `stabilizeStage !== null` forces `cursorMode='normal'`.
- Blink remains CSS-keyframe driven.

## Verification
- `npm run build` passed.

## Manual Checks
1. From part2 click `[<-]`:
   - empty `|` for 200ms
   - previous end-core for 200ms (`...knowledge.|`)
   - backward cut to 80 percent (`...kno...|`) then typing resumes.
2. Cursor blinks normally during A and B holds.
3. Spam clicks during any stage cancel and restart cleanly.
