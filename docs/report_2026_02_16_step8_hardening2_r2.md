# Step 8 Hardening Round 2 Run 2 - Interaction Triggered Refresh

Date: 2026-02-16
Run: r2
Scope: add target interaction-triggered origin refresh with bounded scheduling and throttling.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Added target-level passive interaction listeners:
   - `pointerenter`
   - `pointermove`
   - `wheel`
2. Listener behavior:
   - `pointerenter`: seeds settle tracking and schedules refresh.
   - `pointermove`: throttled refresh (`120ms` gate).
   - `wheel`: schedules refresh (still bounded by existing rAF batching).
3. Scheduling model:
   - all interaction refreshes reuse existing `scheduleViewportUpdate`.
   - no new independent loop introduced.
4. Resource tracking:
   - added `graph-runtime.viewport.position-interaction-listeners` lifecycle tracking.
5. Cleanup:
   - interaction listeners are detached on effect cleanup/target swap path.

## Verification

- `npm run build` passes.
