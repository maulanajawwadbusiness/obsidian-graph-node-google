# Run 5 Report: Lease Instrumentation + System Docs

Date: 2026-02-15
Scope: Step 4 run 5 only

## Files changed

- `src/runtime/graphRuntimeLease.ts`
- `docs/system.md`

## Instrumentation updates

In `src/runtime/graphRuntimeLease.ts`:
- Added counters:
  - `acquire`
  - `deny`
  - `preempt`
  - `release`
  - `staleReleaseIgnored`
- Added debug snapshot export:
  - `getGraphRuntimeLeaseDebugSnapshot()`
  - returns active lease owner/instance and current counters.
- Existing dev event logs remain:
  - `acquire`
  - `deny`
  - `preempt`
  - `release`
  - `stale_release_ignored`

## Documentation updates

In `docs/system.md`:
- Added section `2.7 Graph Runtime Lease Guard (2026-02-15)`.
- Documented:
  - lease purpose
  - owner mount points
  - primitive and mount boundary files
  - priority policy
  - dev instrumentation
  - manual verification checklist for prompt <-> graph transitions.

## Completion check against step 4 acceptance

1. explicit single active runtime guard: implemented (`graphRuntimeLease.ts`).
2. both preview and graph screen participate: implemented.
3. double-mount handling with graph-screen priority: implemented via preempt + preview deny block.
4. deterministic, logged, stale-safe behavior: implemented.
5. build pass: verified in this run.