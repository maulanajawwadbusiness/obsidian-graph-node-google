# Report 2026-02-14: Welcome2 Auto-Advance Forensic Instrumentation

## Scope
Forensic instrumentation for Welcome2 auto-advance to EnterPrompt.

## Confirmed Blocker (Code Path)
- `hasManualSeekRef.current` is set in `seekWithManualInteraction`.
- Auto-advance effect returns early when `hasManualSeekRef.current` is true.
- This is session-persistent in current behavior.

## Forensic Instrumentation Added
File: `src/screens/Welcome2.tsx`

1. Dev/debug gate:
- `debugForensic` enabled when `import.meta.env.DEV` or query `?debugCadence=1`.

2. Seek logs:
- Manual seek path:
  - `[w2] manual seek` with `{ source, ms, epoch, before }`
- Non-manual seek path:
  - `[w2] seek` with `{ source, ms, epoch }`

3. Auto-advance effect logs:
- `[w2] auto-advance check` with:
  - `phase, elapsedMs, totalMs, lastCharTimeMs, isTextFullyRevealed, isDone, hasManualSeek, stabilizeStage`
- `[w2] auto-advance schedule` with:
  - `remainingMs, delayMs, timeToDoneMs`
- `[w2] auto-advance fire`
- `[w2] onNext invoke`

4. Source labels now recorded:
- `restart_click_stageA`
- `restart_stageB`
- `restart_stageC`
- `finish_click_soft_end`

## Write/Callsite Trace Results
- `hasManualSeekRef` write remains only in `seekWithManualInteraction`.
- Stage B/C now use non-manual seek helper (still part of the same user-initiated flow, but no repeated manual-flag writes).
- No mount/init path seek was found that sets manual flag.

## Baseline vs Interaction Expectations
A) Baseline (no [<-]/[->] click):
- Expected: manual flag stays false, timer schedules, transition runs.

B) Interaction (click [<-] or [->] once):
- Expected by current spec: manual flag true, auto-advance disabled for that Welcome2 session.

## Manual Verification
Use `?debugCadence=1` and inspect console:
1. Baseline no-click run: expect schedule, fire, onNext logs; no manual-seek log.
2. Single seek click run: expect manual-seek log and subsequent auto-advance checks with `hasManualSeek: true`.
