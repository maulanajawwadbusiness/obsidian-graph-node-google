# Step 4 Lease-Loss Bug Fix Run 8: StrictMode Safety + Preview Counters

Date: 2026-02-15
Scope: tighten effect cleanup and add debug counters for lease-loss and reacquire behavior.

## Files changed

1. `src/components/SampleGraphPreview.tsx`
2. `src/runtime/GraphRuntimeLeaseBoundary.tsx`

## StrictMode/lifecycle safety fixes

1. Preview unmount cleanup now releases current token ref
- avoids stale captured token release after mid-lifecycle reacquire.
- ensures reacquired token is released on unmount.

2. Graph boundary unmount cleanup now releases current token ref
- same stale cleanup fix in boundary after defensive reacquire.

## Added preview dev counters

In `SampleGraphPreview`:
- `lostLeaseUnmountCount`
- `reacquireAttemptCount`
- `reacquireSuccessCount`

Counters are dev-logged via:
- `[SampleGraphPreview][Lease] ...`

## Result

- subscribe/unsubscribe remains balanced.
- stale-release safety remains enforced by lease module.
- unmount now cleans correct live token for preview and graph boundary.