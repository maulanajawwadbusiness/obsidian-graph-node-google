# Welcome2 Back-Jump Stabilization (50ms)

Date: 2026-02-14

## Scope
- Added a stabilization step before stage-2 part back-jump in Welcome2.
- No change to stage-1 restart behavior.
- No change to [->] finish behavior.

## Behavior Change
When [<-] is clicked for the second time in the same part (stage-2):
1. Seek to an anchor point at the current part boundary (current part collapsed/empty at boundary view).
2. Hold for 50ms.
3. Seek to previous part 80 percent landing.

This applies only to stage-2 back-jump.

## Implementation
- File: `src/screens/Welcome2.tsx`
- Added constant:
  - `STABILIZE_BEFORE_BACK_MS = 50`
- Added refs:
  - `backJumpTimeoutRef`
  - `isBackJumpingRef`
- Added helper:
  - `clearPendingBackJump()` to cancel pending delayed jump and reset back-jump state.
- Added boundary anchor mapper:
  - `toPartBoundaryAnchorMs(startCharCount)`
- Replaced immediate stage-2 path:
  - `goBackOnePart80Percent` -> `goBackOnePartWithStabilize`
  - Step A: seek to boundary anchor in current part.
  - Step B (after 50ms): seek to previous part 80 percent target.
- Input race safety:
  - [<-] clicks are ignored while a back-jump is pending.
  - [->] clears pending back-jump before finish action.
- Cleanup:
  - pending back-jump timeout is cleared on unmount.

## Preserved Contracts
- Stage-1 [<-] restart remains immediate and uses existing pre-char start seek.
- [->] finish remains soft-end seek.
- Manual seek continues to disable auto-advance for current Welcome2 session.
- Existing part-0 stage-2 no-op latch reset remains active.

## Verification
- `npm run build` passed.

## Manual Checklist
1. From mid part2: click1 [<-] restart current part.
2. click2 [<-]: observe boundary anchor moment, then previous part 80 percent jump after about 50ms.
3. Spam [<-] during pending 50ms window: no flicker or multi-jump race.
4. Press [->] during pending 50ms window: pending back-jump cancels, finish action runs.
5. No interaction path: typing cadence remains unchanged.
