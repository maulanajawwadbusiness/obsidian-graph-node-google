# Welcome2 Stabilize Hold Cursor Blink Refinement

Date: 2026-02-14

## Scope
- Ensured cursor keeps normal blink during stage-2 back-jump stabilize hold.
- Preserve existing timeline freeze and delayed jump behavior.

## Problem
- During `STABILIZE_BEFORE_BACK_MS` hold, cursor appeared frozen.
- Root reason: cursor mode resolved to `pause` when `visibleCharCount` was intentionally held.

## Changes
- File: `src/screens/Welcome2.tsx`
- Added stabilize tracking:
  - `isStabilizingBackJumpRef`
  - `isStabilizingBackJump` (React state)
  - helper `setBackJumpStabilizing(isActive)`
- Cursor mode precedence updated:
  - If `isStabilizingBackJump` is true, force `cursorMode = 'normal'`.
  - This takes priority over typing/pause/holdFast derivation.
- Back-jump lifecycle wiring:
  - Stage-2 start sets stabilize active before pause+anchor seek.
  - Delayed jump completion clears stabilize active.
  - `clearPendingBackJump()` now always clears stabilize active.

## Why This Works
- Typing freeze remains in `useTypedTimeline` clock pause.
- Cursor blinking stays CSS-keyframe driven (`TypingCursor`), so forcing `normal` mode during hold provides expected idle blink while text remains fixed.

## Preserved Contracts
- Stage-1 `[<-]` restart behavior unchanged.
- `[->]` finish behavior unchanged and still cancels pending staged back-jump.
- Part-0 stage-2 no-op latch reset unchanged.
- No changes to timeline event generation/cadence.

## Verification
- `npm run build` passed.

## Manual Checklist
1. Set `STABILIZE_BEFORE_BACK_MS=400`.
2. Trigger stage-2 back-jump.
3. Confirm: text is held, cursor blinks normally through full hold.
4. Confirm delayed jump to previous part 80 percent still fires once.
5. Press `[->]` during hold: pending jump cancels; cursor mode returns to normal flow.
