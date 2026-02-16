# Run 4 Report: Graph-Screen Lease Participation

Date: 2026-02-15
Scope: Step 4 run 4 only (graph runtime lease wiring)

## Files changed

- `src/runtime/GraphRuntimeLeaseBoundary.tsx` (new)
- `src/screens/appshell/render/renderScreenContent.tsx`

## What was added

1. Reusable lease boundary component:
   - owner-based acquire/release lifecycle
   - `checking` / `allowed` / `denied` states
   - optional `blockOnDeny` behavior
2. Graph-class runtime mount wrapped by lease boundary:
   - seam: `renderScreenContent.tsx` around `GraphWithPending`
   - owner used: `graph-screen`
   - pending fallback while lease resolves: `Starting graph runtime...`

## Priority behavior proof

- Lease primitive from run 2 preempts active preview lease when owner is `graph-screen`.
- This run routes graph mount through that path, so graph-screen is now explicit participant and winner.

## Stale-token safety

- Preempted preview token cannot release graph lease because `releaseGraphRuntimeLease` ignores non-active tokens.

## Contract safety

- Warm-mount graph-class subtree remains shared and unkeyed (wrapper added in-place around existing runtime node).
- Existing graph props and load gate wiring were left intact.