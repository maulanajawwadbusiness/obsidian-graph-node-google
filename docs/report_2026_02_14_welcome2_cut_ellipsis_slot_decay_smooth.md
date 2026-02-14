# Welcome2 Cut Ellipsis Smoothness Fix (Slot-Based Decay)

Date: 2026-02-14

## Scope
- Fix visible lag during back-jump cut ellipsis decay in Welcome2.
- Preserve Stage A/B/C back-jump flow and manual-seek contracts.

## Problem
- The previous progressive delete model changed visible ellipsis length over time.
- Shrinking inline ellipsis width can trigger text reflow and cursor position shifts near wrap boundaries.
- Result: perceived lag or abrupt visual stutter during decay.

## Changes
- File: `src/screens/Welcome2.tsx`

1. Added deterministic decay constants:
   - `CUT_ELLIPSIS_TOTAL_DOTS = 3`
   - `CUT_ELLIPSIS_CHARS_PER_DOT_STEP = 4`

2. Added landing-progress ref:
   - `cutLandingStartCharCountRef`
   - Set at Stage C landing (`cutCharCount`).

3. Kept existing end-core tracking:
   - `cutLandingEndCoreRef`

4. Replaced literal ellipsis rendering with fixed-width slot rendering:
   - Always reserves the same ellipsis footprint (`inline-flex`, fixed width).
   - Renders 3 dot slots.
   - Dot visibility changes by opacity per slot instead of removing width.

5. Added derived dot count:
   - `charsSinceLanding = max(0, visibleCharCount - landingStartCharCount)`
   - `dotStepsConsumed = floor(charsSinceLanding / CUT_ELLIPSIS_CHARS_PER_DOT_STEP)`
   - `dotCount = max(0, CUT_ELLIPSIS_TOTAL_DOTS - dotStepsConsumed)`

6. Cleanup hardening:
   - `clearPendingBackJump()` now clears both cut refs and ellipsis state.
   - Effect clears ellipsis state once dot count reaches 0.

## Preserved Contracts
- `[<-]` still runs deterministic A -> B -> C sequence.
- `[->]` still cancels pending back-jump flow before finish logic.
- Manual seek still suppresses auto-advance for the active session.
- Cursor mode override during stabilize stage remains unchanged.

## Why This Fix Reduces Lag
- Ellipsis container width no longer shrinks during decay.
- No inline text-width collapse means reduced wrap churn and fewer perceived cursor jumps.
- Visual delete semantics are preserved (`... -> .. -> . -> empty`) via slot opacity.

## Verification
- `npm run build` passed.

## Manual Validation Checklist
1. Trigger back-jump Stage C from a middle sentence position.
2. Confirm decay cadence is one dot per 4 typed characters.
3. Confirm sequence appears as delete semantics (`...`, then `..`, then `.`, then hidden).
4. Confirm no abrupt horizontal jump at each decay boundary.
5. Confirm no stale ellipsis after `[->]` or rapid repeated `[<-]` clicks.
