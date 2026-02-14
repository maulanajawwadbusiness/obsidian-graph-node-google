# Welcome2 Two-Stage Back-Jump Stabilization (200ms + 200ms)

Date: 2026-02-14

## Scope
- Refined `[<-]` to a two-stage stabilization sequence.
- Stage A holds at current part start (empty) for 200ms.
- Stage B holds at previous part end-core for 200ms.

## New Flow
On each `[<-]` click:
1. Cancel pending stabilize timers.
2. Compute `curIdx` from `max(0, visibleCharCount - 1)` and `prevIdx = max(0, curIdx - 1)`.
3. Stage A target:
   - current start pre-char (`startMs - 1`, clamped) so first char is not visible.
   - set stage `cur_start`, seek, hold 200ms.
4. Stage B target:
   - previous part end-core exact event time (punctuation visible).
   - set stage `prev_end`, seek, hold 200ms.
5. Clear stage and resume normal flow.

## Cursor Blink Guarantee
- During both holds, `stabilizeStage !== null` forces `cursorMode='normal'`.
- Cursor animation remains CSS-keyframe driven, so blink continues during holds.

## Timer and Stability Hardening
- Uses two timeout refs (`stabilizeTimeoutARef`, `stabilizeTimeoutBRef`).
- New click cancels pending timeouts and restarts sequence deterministically.
- Manual seek still disables auto-advance for current Welcome2 session.
- Unmount cleanup clears pending stabilize timers and auto-advance timer.

## Removed from this flow
- Previous 80 percent landing in stage B.
- Single-stage stabilize timer model.

## Verification
- `npm run build` passed.

## Manual Checks
1. Mid-part click `[<-]`: empty `|` for 200ms then previous end-core for 200ms.
2. Cursor blinks normally during both holds.
3. Spam click during hold restarts sequence cleanly without stale jumps.
