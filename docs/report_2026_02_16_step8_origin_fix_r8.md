# Step 8 Origin Fix Run 8 - Final Audit and Close

Date: 2026-02-16
Run: r8
Scope: final origin-fix audit and dead-path cleanup.

## Final audit checks

1. No origin regression paths:
   - scanned viewport runtime code for `contentRect.left/top` usage.
   - result: zero matches in `src/runtime/viewport/*`.
2. Cleanup warning path sanity:
   - removed unreachable dev warning branch:
     - `[ViewportResize] pending rAF remained after cleanup`
   - reason: `cancelScheduledFrame()` clears pending id before that check, so the warning could never trigger.
3. Step 8 acceptance closure:
   - boxed origin now derives from BCR and flows to step 9 boxed math contract.
   - size clamps and one-rAF scheduling remain intact.

## Verification

- `npm run build` passes.

## Status

- Step 8 origin bug is closed and ready for step 9 re-audit.
