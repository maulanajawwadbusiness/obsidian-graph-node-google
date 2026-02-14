# Welcome2 Pre-Char Sentinel Fix (-1ms)

Date: 2026-02-14

## Scope
- Fix edge case where pre-char seek at `charCount=0` was not guaranteed empty.
- Preserve baseline typing/cadence and global reveal comparator behavior.

## Root Cause
- Pre-char at start=0 previously targeted `0ms`.
- Reveal check is `event.tMs <= elapsedMs`.
- If first event is at `0ms`, `elapsed=0` reveals first char.

## Changes
Files:
- `src/hooks/useTypedTimeline.ts`
- `src/screens/Welcome2.tsx`

### 1) Internal sentinel support in typed timeline
- Added constant: `PRE_CHAR_EPS_MS = 1`.
- `seekToMs(ms)` clamp changed:
  - before: `[0, totalMs]`
  - after: `[-1, totalMs]`
- Internal elapsed can now be `-1` only when explicitly sought.

### 2) Keep exposed elapsed non-negative
- Hook return now exposes:
  - `elapsedMs: Math.max(0, state.elapsedMs)`
- Internal state still uses negative sentinel for visibility/phase calculations.

### 3) Welcome2 pre-char helper update
- `toSentenceStartTargetMs(startCharCount)` now returns `-1` when `startCharCount <= 0`.
- Non-zero starts keep existing behavior (`startEvent.tMs - 1`).

## Why This Is Safe
- No changes to timeline generation or cadence schedule.
- No changes to global reveal comparator (`<=` remains unchanged).
- No-click baseline typing still starts at elapsed `0` and behaves as before.
- Sentinel is only used when explicitly requested by pre-char seek.

## Expected Behavior
- Pre-char seek to start=0 now guarantees `visibleCharCount=0`.
- Phase at internal `-1` remains `typing`, not `hold`.
- Other seeks and normal typing are unchanged.

## Verification
- `npm run build` passed.
