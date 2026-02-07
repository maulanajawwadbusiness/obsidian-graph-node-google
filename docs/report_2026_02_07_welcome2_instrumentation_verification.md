# Welcome2 Typing Instrumentation and Verification

Date: 2026-02-07
Scope: add measurable timing instrumentation for Welcome2 typed manifesto flow.

## Files Added or Updated

- Added: `src/utils/typingMetrics.ts`
- Updated: `src/hooks/useTypedTimeline.ts`
- Updated: `src/screens/Welcome2.tsx`

## Debug Toggle

Use URL query toggle:

- `?debugType=1`

Behavior:
- Debug metrics are OFF by default.
- `Welcome2` reads query params once on mount.
- Hook instrumentation is enabled only when toggle is active (or hardcoded debug constant is set).

## Metrics Collected

In `useTypedTimeline`:

1. Frame dt metrics
- sample each rAF delta: `dtMs = now - lastNow`
- summary reports:
  - avg
  - p95
  - max

2. Character advancement lateness
- when `visibleCharCount` increases:
  - expected time from timeline event (`events[i].tMs`)
  - observed time (`elapsedMs`)
  - sample `latenessMs = elapsedMs - expectedMs`
- summary reports:
  - count
  - p50
  - p95
  - max

3. Phase transition timing
- captures:
  - `holdAtMs`
  - `doneAtMs`

4. Correctness guards
- verifies each frame:
  - `visibleCharCount` never decreases
  - `visibleCharCount` never exceeds `renderText.length`
- on violation:
  - logs once with `[Welcome2Type]`
  - stops rAF loop to avoid runaway
  - emits summary immediately

## Summary Logging Policy

- One summary log bundle only:
  - when phase reaches `done`, or
  - on unmount cleanup if done did not occur yet, or
  - on guard-stop
- No per-frame spam.
- Optional progress log remains bucketed at ~500ms intervals.

## Metrics Utility Module

`src/utils/typingMetrics.ts` exports tiny dependency-free helpers:
- `nowMs()`
- `clamp(...)`
- `avg(...)`
- `quantiles(...)` returning `{ p50, p90, p95, p99, max }`

## Suggested Acceptance Targets

For a normal machine and active foreground tab:
- frame dt p95 <= 25ms
- char lateness p95 <= 35ms

Notes:
- max lateness spikes can occur on tab backgrounding, CPU spikes, or system load.
- deterministic catch-up should still preserve monotonic visible count and stable final output.

## Manual Verification Checklist

1. Open app with `?debugType=1`, navigate to Welcome2, confirm typing starts immediately.
2. Observe summary output after typing completes:
   - chars count
   - frame dt stats
   - char lateness stats
   - hold/done timestamps
3. Press Back/Skip mid-typing:
   - confirm cleanup summary appears once
   - confirm no further typing logs after unmount
4. Background tab for ~2s and return:
   - confirm no negative or broken count behavior
   - typing catches up deterministically
5. Hard refresh and compare:
   - `built.totalMs` consistency
6. Run `npm run build`.

## Non-Changes

- No cadence number changes.
- No marker text changes.
- No timeline algorithm changes.
- No audio code added.
