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