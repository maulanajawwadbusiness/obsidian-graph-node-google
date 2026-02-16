# Step 4 Lease-Loss Bug Fix Run 6: Preempt/Stale Safety + Dev Assertion

Date: 2026-02-15
Scope: finalize lease-loss behavior safety and add dev sanity assertion.

## Files changed

1. `src/runtime/graphRuntimeLease.ts`
2. `src/components/SampleGraphPreview.tsx`

## What was tightened

1. Preempt semantics
- preempt already replaced `activeLease` token immediately.
- token-activity checks now deterministically report old token inactive immediately after preempt.

2. Stale release safety
- existing stale release no-op behavior preserved.
- preview now clears token ref on lease loss, avoiding accidental stale release coupling.

3. Dev assertion helper
- added `assertActiveLeaseOwner(owner, token?)` (dev-only warn helper).
- checks active owner/token consistency against snapshot.
- wired into preview subscription when token exists.

## Result

- preempted preview runtime cannot silently keep ownership semantics.
- diagnostics now expose owner/token drift during development.