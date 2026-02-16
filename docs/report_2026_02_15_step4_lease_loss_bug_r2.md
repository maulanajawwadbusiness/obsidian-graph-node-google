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