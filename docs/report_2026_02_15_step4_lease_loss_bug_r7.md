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