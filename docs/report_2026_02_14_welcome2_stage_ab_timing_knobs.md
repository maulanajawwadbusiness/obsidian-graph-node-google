# Welcome2 Back-Jump Timing Knobs Split (Stage A and B)

Date: 2026-02-14

## Scope
- Split shared stabilize hold timing into separate stage knobs.
- Kept existing 3-stage back-jump flow (A -> B -> C).

## Changes
- File: `src/screens/Welcome2.tsx`
- Replaced single constant:
  - removed: `STABILIZE_BEFORE_BACK_MS`
- Added constants:
  - `STABILIZE_STAGE_A_MS = 200`
  - `STABILIZE_STAGE_B_MS = 400`

## Timer Wiring
- Stage A (`cur_start`) hold timeout now uses `STABILIZE_STAGE_A_MS`.
- Stage B (`prev_end`) hold timeout now uses `STABILIZE_STAGE_B_MS`.
- Stage C (80 percent cut seek) remains immediate after stage B hold completion.

## Preserved Behavior
- A: current start pre-char empty hold.
- B: previous end-core hold.
- C: previous 80 percent cut seek and resume typing.
- Cursor normal-blink override during A/B remains unchanged (`stabilizeStage !== null`).
- A/B/C timeout hardening remains unchanged (new click clears all pending timers).
- Unmount cleanup still clears pending stabilize timers and auto-advance timer.

## Verification
- `npm run build` passed.

## Manual Checks
1. Trigger `[<-]` from part2 and confirm A hold is about 200ms.
2. Confirm B hold is visibly about 400ms.
3. Confirm C cut seek still occurs after B hold and typing resumes.
4. Confirm cursor blinks normally during A and B.
5. Confirm spam clicks cancel/restart sequence deterministically.
