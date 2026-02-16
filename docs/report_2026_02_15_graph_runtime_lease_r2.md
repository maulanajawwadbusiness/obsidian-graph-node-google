# Run 2 Report: Graph Runtime Lease Primitive

Date: 2026-02-15
Scope: Step 4 run 2 only (global lease primitive)

## Added module

- `src/runtime/graphRuntimeLease.ts`

## Exported API

- `GraphRuntimeOwner = 'graph-screen' | 'prompt-preview' | 'unknown'`
- `acquireGraphRuntimeLease(owner, instanceId)` returns:
  - success: `{ ok: true, token }`
  - failure: `{ ok: false, activeOwner, activeInstanceId }`
- `releaseGraphRuntimeLease(token)`
- `getActiveGraphRuntimeLease()`

## Priority and safety rules implemented

1. Single active lease at a time (module-level active record).
2. Graph-screen acquisition is preemptive:
   - If preview lease is active, graph-screen replaces it with a new token.
   - Old preview token becomes stale and cannot release the new lease.
3. Non-graph owner is denied when graph-screen lease is active.
4. Non-graph owner is also denied when another non-graph lease is active.
5. Stale/no-active release calls are ignored safely.

## Determinism + diagnostics

- Monotonic token sequence: `graph_runtime_lease:<owner>:<n>`.
- Dev-only diagnostics:
  - `acquire`
  - `preempt`
  - `deny`
  - `release`
  - `stale_release_ignored`

## Notes

- This run intentionally does not wire the lease into preview or graph mount points yet.
- No runtime behavior change expected in this run.