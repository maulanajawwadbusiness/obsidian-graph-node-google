# Report 2026-02-14: Welcome2 Last-Char Hold vs Done Contract

## Scope
Edge case #4 hardening for Welcome2 timeline end behavior.

## Problem
Welcome2 had an end-boundary ambiguity:
- At `elapsedMs == events[last].tMs`, all chars are visible, but timeline is still in `hold`.
- True completion is `elapsedMs >= totalMs`.

Some call sites can accidentally treat "last char visible" as "done", which can trigger completion behavior too early.

## Changes Applied

### 1) `useTypedTimeline` explicit end-state contract
File: `src/hooks/useTypedTimeline.ts`

Added outputs:
- `lastCharTimeMs: number`
- `isTextFullyRevealed: boolean`
- `isDone: boolean` (explicitly based on `elapsedMs >= totalMs`)
- `timeToDoneMs: number`

Notes:
- `phase` behavior is unchanged.
- Added comment that `hold` is intentional post-typing hold and is not done.
- Internal negative elapsed support remains unchanged from prior fix; exposed `elapsedMs` is still clamped for UI.

### 2) `Welcome2` auto-advance scheduling now uses true done-time
File: `src/screens/Welcome2.tsx`

Updated logic:
- Removed scheduling anchor based on `lastTypedCharMs`.
- Auto-advance now schedules by `timeToDoneMs + WELCOME2_AUTO_ADVANCE_DELAY_MS`.
- Guarded with `isDone` to avoid redundant scheduling once done.

Result:
- No premature completion behavior at last-char boundary.
- Auto-advance remains deterministic and now aligns with full timeline completion.

## Why This Is Safe
- No changes to timeline generation.
- No changes to typing cadence math for normal playback.
- No changes to seek/back-jump architecture.
- Change is isolated to explicit state contract + one scheduling call site.

## Manual Verification Checklist
1. Seek to `events[last].tMs`:
   - All chars visible.
   - Phase is `hold`.
   - No done-only behavior should trigger yet.
2. Wait until `totalMs`:
   - Phase becomes `done`.
   - Completion behavior is now valid.
3. Normal no-click run:
   - Typing cadence unchanged.
   - End transition feels same except contract correctness at boundary.
4. End boundary controls:
   - `[->]` at end remains safe no-op.
   - No timer corruption after seek interactions.
