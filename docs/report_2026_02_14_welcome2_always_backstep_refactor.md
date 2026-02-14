# Welcome2 [<-] Always-Backstep Refactor

Date: 2026-02-14

## Scope
- Removed latch-memory and restart-current-part behavior from `[<-]`.
- `[<-]` is now always stabilize-then-backstep on first click.

## Removed
- `restartedThisPartRef` and `lastPartIdxRef` latch logic.
- Restart-current-part path for `[<-]`.
- Any implicit two-stage click behavior for `[<-]`.

## New [<-] Flow
Every click on `[<-]` does:
1. Cancel pending back-jump timeout if present.
2. Mark manual interaction and clear stale auto-advance timer.
3. Compute current part index from `max(0, visibleCharCount - 1)`.
4. Step A seek to current part start pre-char (`startMs - 1`, clamped) and hold for `STABILIZE_BEFORE_BACK_MS` (400ms).
5. Step B seek to previous part 80 percent core landing.

## Preserved Rules
- Part delimiters unchanged: `, . ! ? ; :`
- Landing policy unchanged: 80 percent of previous part core.
- Manual seek still disables auto-advance for current Welcome2 session.
- Timer hardening remains (`clearAutoAdvanceTimer`, pending timeout cleanup).
- Pending back-jump click spam is deterministic: cancel and restart cycle.

## Cursor Blink Guarantee
- During stabilize hold, `isStabilizingBackJump` forces `cursorMode='normal'` in Welcome2.
- `TypingCursor` remains CSS-keyframe driven, so blink stays active during hold.

## Validation
- `npm run build` passed.

## Manual Checks To Run
1. One click `[<-]` mid part: stabilize hold then jump previous part 80 percent.
2. Repeated spam clicks during hold: no race chaos; latest click governs.
3. Part 0 click: stabilize then safe no-op/same-target jump; no crash.
4. Cursor blinks normally for full 400ms hold.
5. `[->]` still works and cancels pending back-jump.
