# Step 8 Origin Fix Run 6 - Tracker and Invariant Audit

Date: 2026-02-16
Run: r6
Scope: verify resource tracker balance and bounded scheduler invariants in the updated hook.

## Audit findings

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Observer tracker lifecycle is balanced:
   - acquire once on effect setup:
     - `trackResource('graph-runtime.viewport.resize-observer')`
   - release once on cleanup:
     - `releaseObserverTrack()`
2. rAF tracker lifecycle is bounded:
   - acquire only when scheduling while no pending id:
     - `if (pendingRafIdRef.current !== null) return`
     - `trackResource('graph-runtime.viewport.resize-raf')`
   - release in both flush and cancel paths:
     - flush path release before processing
     - cleanup cancel path release on pending id
3. Cleanup safety remains:
   - disposed flag set before cancellation/disconnect.
   - observer disconnected and refs nulled on cleanup.
4. No tracker naming drift:
   - `graph-runtime.viewport.resize-observer`
   - `graph-runtime.viewport.resize-raf`

## Outcome

- tracker ownership remains aligned with observer lifecycle and one-rAF scheduling invariants.

## Verification

- `npm run build` passes.
