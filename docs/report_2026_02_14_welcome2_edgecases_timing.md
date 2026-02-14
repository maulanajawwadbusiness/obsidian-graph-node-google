# Welcome2 Edge Cases Timing ScanDissect (Part 0 and Last Part)

Date: 2026-02-14
Primary files:
- `src/screens/Welcome2.tsx`
- `src/hooks/useTypedTimeline.ts`
- `src/screens/welcome2SentenceSpans.ts`

## Summary
Welcome2 seek timing is mostly guarded already: `seekToMs()` clamps elapsed to `[0, totalMs]`, and seek helpers clamp target char counts to `[0, events.length]`.

The two highest boundary risks are:
1. `[<-]` at part 0 is not a no-op today. It still runs A/B/C and can jump within part 0 unexpectedly.
2. `toSentenceStartTargetMs(0)` returns `0`, which is not guaranteed to be pre-char if first event is at `t=0`.

Current behavior is deterministic, but these edge cases can feel inconsistent near start/end boundaries.

## Boundary Truth Table
| Edge case | Observed behavior now | Risk | Minimal fix |
|---|---|---|---|
| Seek to `t=0` / `charCount=0` (part 0 start) | `toSentenceStartTargetMs(0)` returns `0`. `seekToMs(0)` clamps and applies. If first event is at `t=0`, `visibleCharCount` can be `1` not `0`. Phase usually `typing` unless empty timeline. | "pre-char" intent at part 0 may be violated; first char may appear during Stage A hold. | Special-case part 0 pre-char contract: if `startCharCount===0`, define explicit no-op-at-zero behavior, or introduce a tiny internal pre-char sentinel rule in seek helper logic. |
| Seek to part 0 endCore | `toSentenceEndTargetMs(endCore)` returns `events[endCore-1].tMs` (or `0` if `endCore<=0`). `visibleCharCount` becomes endCore count. Phase at exact last char time is `hold`. | None severe; behavior is stable. | Keep as-is. |
| Seek to part 0 endSoft | Finish path uses endSoft char count. If endSoft includes trailing ws/newline, seek lands at that char event time. | None severe; deterministic. | Keep as-is; already clamped. |
| Seek to last part start (trailing no `.` part) | Span builder always creates trailing part: fallback adds `[start..len]` when no period. Start target uses `toSentenceStartTargetMs(start)`, returning `events[start].tMs-1` when possible. | If `start==0`, same part-0 pre-char caveat applies. | Keep span fallback; add explicit part-0 policy only. |
| Seek to last char event (`events[len-1].tMs`) | `visibleCharCount=len`, `phase='hold'` (not `done`) because `done` requires `elapsedMs>=totalMs`. | UX confusion if callers assume last char == done. | Keep; document that done is hold+endHold completion. |
| Seek beyond last event / seek to hold region (`totalMs`) | `seekToMs(ms)` clamps to `[0,totalMs]`. At `totalMs`, `visibleCharCount=len`, `phase='done'`. | None severe; this is correct contract. | Keep as-is. |
| Click `[<-]` at part 0 | Current logic always computes `previousPartIdx=max(0,current-1)` => still 0. It runs A/B/C with part 0 targets instead of no-op. | Can jump forward/back within same part and feel broken at boundary. | Recommended: explicit no-op when `currentPartIdx===0` (or stabilize-only if product wants animation). |
| Click `[->]` in last part / already finished | `finishCurrentSentence()` computes target soft end, no-op when `targetCharCount <= visibleCharCount`. | Low risk; already safe. | Keep as-is. |
| Seek during stabilize A/B/C targeting part 0/last part | New click calls `cancelBackJumpSequence()` first, clearing timers and unpausing before new action. Stage callbacks use clamped seek helpers. | Low race risk remains if callback already entered event loop tick before cancel click. Usually deterministic in single-thread JS. | Keep design; optional epoch token on A/B/C callbacks for belt-and-suspenders stale callback rejection. |
| Spam clicks `[<-]` mid-flight | Each click clears A/B/C timers then restarts deterministic sequence. | Minor stale-callback window if callback starts just before cancel path executes. | Optional epoch id guard in callbacks (`if (token!==current) return`). |
| Timeline with 0 events (empty text) | Guards exist: `goPreviousPartWithStabilize` and `finishCurrentSentence` early-return when `events.length===0`; helpers clamp safely to `0`; `useTypedTimeline` returns `visibleCharCount=0`, phase based on totalMs (usually done/hold-safe). | Very low risk. | Keep as-is; already guarded. |

## Per-Case Technical Notes

### Clamp behavior
- `seekToMs(ms)` in `useTypedTimeline` clamps `targetElapsedMs = clamp(round(ms), 0, totalMs)`.
- `toSentenceEndTargetMs(targetCharCount)` clamps count to `[0, events.length]` and returns `0` for `<=0`.
- `toSentenceStartTargetMs(startCharCount)` clamps start to `[0, events.length]`; returns `0` for `<=0`; returns `totalMs` when start index equals events length.

### `visibleCharCount` outcomes
- At `elapsed=0`, `visibleCharCount` depends on whether `events[0].tMs` is `0`.
- At `elapsed=events[len-1].tMs`, `visibleCharCount=len`.
- At `elapsed=totalMs`, `visibleCharCount=len`.

### `phase` outcomes (`getPhase`)
- `done` only when `elapsedMs >= totalMs`.
- `hold` when `elapsedMs >= lastCharTimeMs` but `< totalMs`.
- `typing` otherwise.

### Monotonic guard
- Guard in `useTypedTimeline` fires only for backward visible-count movement when no seek epoch change.
- Backward jumps from manual seek are allowed by `seekEpochRef` and should not trip the guard.

### Cursor-mode freeze classification
- During stabilize (`stabilizeStage!==null`), cursor forced to `normal` blink regardless of phase.
- Outside stabilize:
  - `typing`/`pause` based on `elapsedMs-lastAdvanceRef` threshold.
  - `holdFast` then `normal` during hold.
- Misclassification risk is low; boundary behavior mostly intentional.

## Recommended Hardening (Minimal Diffs)

1. Explicit part-0 `[<-]` policy (recommended no-op)
- In `goPreviousPartWithStabilize()`, after computing `currentPartIdx`, add:
  - if `currentPartIdx===0`: cancel pending timers, keep focus, return.
- Prevents unexpected same-part A/B/C sequence at boundary.

2. Clarify pre-char semantics at part 0
- Document that `t=0` is best-effort pre-char and may show first char if first event is at `0`.
- Optional minimal code tweak: add helper comment and explicit branch so future edits do not assume guaranteed empty pre-char at index 0.

3. Optional stale-callback race hardening
- Add a back-jump epoch token:
  - increment epoch at sequence start/cancel,
  - each A/B/C timeout callback checks token before acting.
- Small diff, removes rare stale callback edge.

4. Keep existing clamps and 0-event guards
- They are correct and should remain unchanged.

## Verification Steps (Manual)

1. Part 0 boundary
- Navigate to part 0 position.
- Click `[<-]` repeatedly.
- Watch for: no unintended forward/back jumps inside same part if no-op policy is applied.

2. Last part boundary (with and without trailing `.`)
- Reach last part start and end.
- Click `[->]` at end/finished.
- Watch for: clean no-op, no timer or phase corruption.

3. Stabilize mid-flight cancellation
- Start `[<-]`, then spam `[<-]` and `[->]` during A/B holds.
- Watch for: deterministic cancel/restart, no stale delayed jumps.

4. Hold vs done phase boundary
- Seek to last char event and observe hold.
- Wait until end-hold reaches done.
- Watch for: no cadence break, no cursor freeze anomalies.

5. Empty timeline guard (dev-only synthetic)
- Use empty manifesto text fixture.
- Verify no crashes; buttons no-op safely.

## Final Assessment
- Core timing model is stable and clamped.
- Real boundary weakness is behavioral clarity at part 0 under `[<-]`, not raw math safety.
- Minimal hardening should prioritize explicit part-0 policy and (optionally) timeout epoch guard.

## Applied Fix #1 (Implemented)

Date: 2026-02-14

Change applied in `src/screens/Welcome2.tsx`:
- In `goPreviousPartWithStabilize()`:
  1. still computes `currentPartIdx` first.
  2. still calls `clearAutoAdvanceTimer()` and `cancelBackJumpSequence()`.
  3. adds strict boundary guard:
     - `if (currentPartIdx <= 0) { focus; return; }`
  4. only non-zero part continues into A/B/C seek sequence.

Effect:
- `[<-]` at part 0 is now a strict no-op on navigation.
- No `seekToMs` call is made on part-0 path.
- No manual-seek flag update occurs on part-0 path.
- Pending stabilize timers/stage are still canceled safely.

Expected user-visible outcome:
- Spamming `[<-]` at beginning causes no flicker, no holds, no cursor relocation, and no delayed jumps.
- Returning to part 0 from later parts preserves same no-op rule.
