# Merged Markdown Report

Generated: 2026-02-16 06:34:45

## Table of Contents

- [report_2026_02_15_step4_lease_loss_bug_r1.md](#report20260215step4leaselossbugr1)
- [report_2026_02_15_step4_lease_loss_bug_r2.md](#report20260215step4leaselossbugr2)
- [report_2026_02_15_step4_lease_loss_bug_r3.md](#report20260215step4leaselossbugr3)
- [report_2026_02_15_step4_lease_loss_bug_r4.md](#report20260215step4leaselossbugr4)
- [report_2026_02_15_step4_lease_loss_bug_r5.md](#report20260215step4leaselossbugr5)
- [report_2026_02_15_step4_lease_loss_bug_r6.md](#report20260215step4leaselossbugr6)
- [report_2026_02_15_step4_lease_loss_bug_r7.md](#report20260215step4leaselossbugr7)
- [report_2026_02_15_step4_lease_loss_bug_r8.md](#report20260215step4leaselossbugr8)
- [report_2026_02_15_step4_lease_loss_bug_r9.md](#report20260215step4leaselossbugr9)
- [report_2026_02_15_step4_lease_loss_bug_r10.md](#report20260215step4leaselossbugr10)

---

## report_2026_02_15_step4_lease_loss_bug_r1.md

# Step 4 Lease-Loss Bug Fix Run 1: Forensic Pinpoint

Date: 2026-02-15
Scope: Prove current lease-loss failure mode and identify hook points.

## Current behavior map

1. Lease preempt occurs in runtime lease module
- `src/runtime/graphRuntimeLease.ts:77`
- `graph-screen` acquisition replaces active lease via `createLease(...)`.
- Old token is stale but no active push signal exists to mounted consumers.

2. Preview mount decision is one-time local state
- `src/components/SampleGraphPreview.tsx:185`
- preview acquires lease in `useLayoutEffect` on mount.
- `leaseState` is set once (`allowed` or `denied`) and later render uses that static state.
- runtime mount gate is `canMountRuntime` at `src/components/SampleGraphPreview.tsx:207`.

3. No post-mount lease ownership revalidation in preview
- `src/components/SampleGraphPreview.tsx` has no subscription/snapshot/token-active checks.
- if preview mounted with valid token and later got preempted, component does not self-unmount runtime.

4. Graph-screen path preempts correctly but does not force loser to stop
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:33`
- graph boundary acquires `graph-screen` lease.
- `renderScreenContent` mounts boundary around graph runtime at `src/screens/appshell/render/renderScreenContent.tsx:101`.
- loser preview runtime can remain mounted if coexistence occurs briefly.

## Failure mode (3 bullets)

1. Preempted preview token becomes stale but preview runtime keeps rendering because no active-token enforcement.
2. Coexisting trees (StrictMode or transition overlap) can leave preview runtime alive without ownership.
3. Lease currently blocks future acquisitions but does not self-enforce stop on already-mounted loser.

## Hook points for lease-loss unmount fix

1. Lease module (`src/runtime/graphRuntimeLease.ts`): add snapshot/subscription/token-active API.
2. Preview component (`src/components/SampleGraphPreview.tsx`): subscribe and force unmount when token inactive.
3. Graph boundary (`src/runtime/GraphRuntimeLeaseBoundary.tsx`): optional defensive re-acquire if token unexpectedly inactive.

## Run 1 outcome

- Bug confirmed with exact mount + preempt path.
- Required seams identified for self-enforcing ownership implementation.

---

## report_2026_02_15_step4_lease_loss_bug_r2.md

# Step 4 Lease-Loss Bug Fix Run 2: Enforcement Design

Date: 2026-02-15
Scope: Lock smallest lease self-enforcement seam before coding.

## Planned API additions (runtime lease module)

1. `getGraphRuntimeLeaseSnapshot()`
- returns `{ activeOwner, activeInstanceId, activeToken, epoch }`.

2. `subscribeGraphRuntimeLease(cb)`
- pub/sub for lease state changes.
- callback receives snapshot.
- returns unsubscribe function.

3. `isGraphRuntimeLeaseTokenActive(token)`
- strict owner-token check against current active token.

## Epoch/staleness model

- Add module-level `leaseEpoch`.
- Increment epoch only when active lease changes:
  - successful acquire (including preempt)
  - successful release
- denied acquire does not change active lease and does not increment epoch.

## Notify model

- Notify subscribers on active-state transitions only:
  - acquire/preempt success
  - release success
- Optional notify on deny is not required for correctness and is omitted to avoid churn loops.

## Preview self-enforcement design

1. On acquire success, preview stores token ref + owns-lease state.
2. Preview subscribes to lease snapshot changes.
3. If owns token and token becomes inactive, preview immediately pauses and unmounts runtime.
4. Reacquire path (later run): one attempt per observed epoch change, no timers.

## StrictMode safety notes

1. subscribe/unsubscribe must be effect-balanced.
2. release with stale token remains no-op (already implemented).
3. reacquire is epoch-gated to prevent oscillation.

---

## report_2026_02_15_step4_lease_loss_bug_r3.md

# Step 4 Lease-Loss Bug Fix Run 3: Lease Snapshot + Subscription APIs

Date: 2026-02-15
Scope: Add runtime lease observability primitives (no consumer wiring yet).

## File changed

- `src/runtime/graphRuntimeLease.ts`

## Added APIs

1. `getGraphRuntimeLeaseSnapshot()`
- returns `{ activeOwner, activeInstanceId, activeToken, epoch }`.

2. `subscribeGraphRuntimeLease(subscriber)`
- pub/sub registration
- returns unsubscribe function

3. `isGraphRuntimeLeaseTokenActive(token)`
- strict active-token check for mounted consumer self-enforcement

## Internal additions

1. `leaseEpoch` counter
- increments on active lease transitions:
  - successful acquire/preempt
  - successful release

2. subscriber set + notify function
- `notifyLeaseSubscribers()` dispatches snapshot to all listeners

3. debug counters extended
- `notifyCount`
- `tokenInactiveChecks`

## Notify wiring

- notify now runs on:
  - acquire success
  - deny
  - release success

## Compatibility

- existing acquire/release/preempt behavior is preserved.
- no preview or boundary consumer logic changed in this run.

---

## report_2026_02_15_step4_lease_loss_bug_r4.md

# Step 4 Lease-Loss Bug Fix Run 4: Preview Self-Enforcing Lease Ownership

Date: 2026-02-15
Scope: force preview runtime stop when preview loses active lease token.

## File changed

- `src/components/SampleGraphPreview.tsx`

## State machine updates

- Lease states now include:
  - `checking`
  - `allowed { token }`
  - `denied { activeOwner, activeInstanceId }`
  - `paused { reason: lost_lease | denied }`

## Enforcement logic added

1. On acquire success:
- store token in `activeLeaseTokenRef`
- set `leaseState=allowed`

2. Subscribe to lease updates:
- uses `subscribeGraphRuntimeLease(...)`
- when token ref exists and `isGraphRuntimeLeaseTokenActive(token)` is false:
  - set state to `paused(lost_lease)`
  - clear token ref

3. Mount gate remains strict:
- runtime mounts only when `leaseState.phase === 'allowed'` and payload/portal are ready.
- if paused, runtime is not mounted.

## UI behavior

- New paused fallback on lease loss:
  - `preview paused (graph active elsewhere)`

## Result

- already-mounted preview runtime now self-unmounts when lease ownership is lost.

---

## report_2026_02_15_step4_lease_loss_bug_r5.md

# Step 4 Lease-Loss Bug Fix Run 5: Epoch-Gated Reacquire for Mounted Preview

Date: 2026-02-15
Scope: allow paused/denied preview to reacquire safely without polling.

## File changed

- `src/components/SampleGraphPreview.tsx`

## Added logic

1. Reacquire guards
- `leaseStateRef` tracks latest lease phase for subscription callback.
- `lastReacquireEpochRef` prevents repeated attempts in same lease epoch.

2. Subscription behavior
- On each lease snapshot update:
  - if preview has token and token inactive -> force pause and clear token.
  - if preview has no token and phase is `paused/denied/checking`:
    - only try reacquire once per epoch
    - skip reacquire while `activeOwner === graph-screen`

3. Reacquire outcomes
- success -> set `allowed` and token ref
- deny -> set explicit `denied` state

## Safety characteristics

- no intervals/timeouts
- no busy loops
- strictly event-driven by lease snapshot updates

---

## report_2026_02_15_step4_lease_loss_bug_r6.md

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

---

## report_2026_02_15_step4_lease_loss_bug_r7.md

# Step 4 Lease-Loss Bug Fix Run 7: Defensive Graph Boundary Enforcement

Date: 2026-02-15
Scope: ensure graph boundary re-acquires lease if its token is ever inactive.

## File changed

- `src/runtime/GraphRuntimeLeaseBoundary.tsx`

## Added behavior

1. Boundary stores active token in ref on successful acquire.
2. Boundary subscribes to lease snapshot updates.
3. On update:
- if boundary token is active, do nothing
- if token missing/inactive, attempt reacquire once per epoch
4. Reacquire success sets state back to `allowed` with new token.
5. Reacquire deny sets `denied` state (existing `blockOnDeny=false` graph path still renders children).

## Safety goal

- Graph-screen path stays resilient even if token churn or overlap edge cases occur.
- No interval polling; event-driven only.

---

## report_2026_02_15_step4_lease_loss_bug_r8.md

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

---

## report_2026_02_15_step4_lease_loss_bug_r9.md

# Step 4 Lease-Loss Bug Fix Run 9: Docs + Verification Checklist

Date: 2026-02-15
Scope: document self-enforcing lease model and verification routine.

## File updated

- `docs/system.md`

## Documentation additions

1. Lease snapshot/subscription/token-active APIs documented.
2. Lease-loss unmount contract documented for `SampleGraphPreview`.
3. Defensive graph boundary reacquire behavior documented.
4. Debug counters/log expectations documented.

## Manual verification checklist now covers

1. prompt preview acquires and mounts.
2. graph transition preempts prompt lease.
3. preview self-pauses/unmounts if it loses token while still mounted.
4. rapid toggles do not allow zombie preview runtime alongside active graph owner.

---

## report_2026_02_15_step4_lease_loss_bug_r10.md

# Step 4 Lease-Loss Bug Fix Run 10: Runtime Invariant Self-Check

Date: 2026-02-15
Scope: add dev-only guardrail for lease snapshot consistency.

## File changed

- `src/runtime/graphRuntimeLease.ts`

## Added guardrail

1. Dev-only one-time invariant check:
- validates snapshot active fields consistency:
  - either all null (`no active lease`)
  - or all non-null (`active lease fully defined`)

2. Warn-once behavior:
- logs `invariant_violation` once if inconsistent snapshot is detected.
- no production overhead beyond static function presence (execution guarded by `import.meta.env.DEV`).

## Why this closes the loop

- runtime ownership is now observable, self-enforcing, and guarded by invariant checks.
- if future refactors break snapshot coherence, development receives immediate signal.
