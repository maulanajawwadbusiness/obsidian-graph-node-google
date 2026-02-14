# Welcome2 Back-Jump Stabilization Freeze Fix

Date: 2026-02-14

## Scope
- Fixed a stabilization-window bug where typing continued during delayed stage-2 back-jump.
- Applied only to Welcome2 part-latch stage-2 back-jump path.

## Problem
- During `STABILIZE_BEFORE_BACK_MS` (currently 400ms), Step A seek moved to current-part anchor, but timeline clock kept advancing.
- Result: current part continued typing before delayed jump to previous part, causing abrupt visual transition.

## Root Cause
- `useTypedTimeline` had no clock pause seam.
- Elapsed time was always computed from wall clock every frame:
  - `(now - startTime) + offset`
- Seek alone repositions playhead but does not freeze time progression.

## Changes

### 1) Typed timeline clock control
- File: `src/hooks/useTypedTimeline.ts`
- Extended hook return type with:
  - `setClockPaused(paused: boolean)`
- Added internal refs:
  - `isClockPausedRef`
  - `pauseStartedNowMsRef`
- Behavior:
  - `setClockPaused(true)` freezes elapsed progression.
  - `setClockPaused(false)` shifts `startTimeMsRef` by pause duration so resume is smooth with no elapsed jump.
  - While paused, rAF loop stays active but `elapsedMs` remains fixed.

### 2) Welcome2 stage-2 integration
- File: `src/screens/Welcome2.tsx`
- Updated hook usage to consume `setClockPaused`.
- Updated `clearPendingBackJump()` to always release paused clock.
- Stage-2 back-jump flow now:
  1. clear pending jump
  2. set `isBackJumpingRef = true`
  3. `setClockPaused(true)`
  4. seek to stabilize anchor in current part
  5. wait `STABILIZE_BEFORE_BACK_MS`
  6. seek previous-part 80% target
  7. latch updates
  8. `setClockPaused(false)`

## Preserved Behavior
- First-click `[<-]` restart remains immediate.
- `[->]` finish remains unchanged and clears pending jump.
- Part-0 stage-2 no-op latch reset remains unchanged.
- Manual seek auto-advance suppression contract remains unchanged.

## Verification
- `npm run build` passed.

## Manual Validation Checklist
1. Set `STABILIZE_BEFORE_BACK_MS=400`.
2. Trigger stage-2 back-jump from mid part:
   - text should hold stable at anchor during full wait.
   - no additional chars typed during wait.
3. After wait, jump to previous part 80% should occur once.
4. Spam `[<-]` during wait should not cause race/flicker.
5. Press `[->]` during wait should cancel pending jump and continue normally.
6. No-interaction typing cadence should match pre-fix behavior.
