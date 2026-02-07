# Welcome2 Visual Typing Engine (Step 3)

Date: 2026-02-07
Scope: Add visual typing engine driven by built timeline. No audio.

## Files Added or Updated

- Added: `src/hooks/useTypedTimeline.ts`
- Updated: `src/screens/Welcome2.tsx`

## Hook API

Module: `src/hooks/useTypedTimeline.ts`

Exports:
- `type TypedTimelinePhase = 'typing' | 'hold' | 'done'`
- `type TypedTimelineState`
  - `visibleCharCount`
  - `visibleText`
  - `phase`
  - `isTypingDone`
  - `isDone`
  - `elapsedMs`
- `function getVisibleCharCountAtElapsed(events, elapsedMs)`
- `function useTypedTimeline(built)`

Input:
- `BuiltTimeline` from `buildWelcome2Timeline(...)`

Output behavior:
- `visibleCharCount` and `visibleText` are computed from timeline event times.
- `isTypingDone` flips when last char time is reached.
- `isDone` flips after `built.totalMs` (includes end hold).

## Timeline-Based Visible Count

`useTypedTimeline` uses `requestAnimationFrame` with `performance.now()`.

Per frame:
1. `elapsedMs = now - startTime`
2. `visibleCharCount = getVisibleCharCountAtElapsed(events, elapsedMs)` via binary search
3. Phase resolution:
   - `typing`: elapsed < lastCharTime
   - `hold`: lastCharTime <= elapsed < totalMs
   - `done`: elapsed >= totalMs

Design notes:
- No per-tick `+1` progression is used.
- Count is derived from elapsed time each frame, so frame drops or tab switches still map to deterministic timeline state.
- rAF loop stops when `phase === 'done'`.

## StrictMode and Unmount Safety

Safety behavior in hook effect:
- Start time resets on each effect run.
- rAF id is canceled in cleanup.
- `isActive` flag prevents state writes after unmount.
- State is reinitialized on effect start for deterministic reruns in dev StrictMode.

This ensures Back/Skip unmount does not leave a live animation loop.

## Welcome2 Integration Notes

In `src/screens/Welcome2.tsx`:
- Timeline built once with:
  - `buildWelcome2Timeline(MANIFESTO_TEXT, DEFAULT_CADENCE)`
- `useTypedTimeline(builtTimeline)` drives `visibleText`.
- Text renders with `whiteSpace: 'pre-wrap'` to preserve line breaks.
- Cursor added inline (`|`) with blink animation.
- Previous auto-advance timer was removed to avoid fighting timeline-driven typing flow.

## Guarded Instrumentation

In hook:
- `DEBUG_WELCOME2_TYPE = false` by default.
- When enabled, logs at 500ms buckets only:
  - `[Welcome2Type] elapsedMs, visibleCharCount, phase`

No per-frame log spam.

## Verification Notes

Checks executed:
- Build passed (`npm run build`).
- Timeline math sanity checked with helper function against built manifesto timeline:
  - start count at 0ms
  - mid progression
  - full count at/after last char time
  - done threshold at/after `totalMs`
- Render path uses `visibleText`, so final copy remains marker-stripped from builder output.

Manual UI expectations for quick local check:
- Comma/period/marker/paragraph pauses visibly affect typing cadence.
- Cursor blinks during typing and hold.
- Back/Skip unmount stops loop.
