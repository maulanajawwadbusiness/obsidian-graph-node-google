# Step 5 Leak Hardening Report (Run 5)

Date: 2026-02-15
Focus: dev invariant checks at runtime boundary unmount seams + system docs

## Code Changes

1. `src/runtime/resourceTracker.ts`
- Added `warnIfGraphRuntimeResourcesUnbalanced(source)`.
- Behavior:
  - DEV-only check for non-zero `graph-runtime.*` counters.
  - warns once per unique signature to avoid log spam.

2. `src/components/SampleGraphPreview.tsx`
- Unmount cleanup now calls:
  - `warnIfGraphRuntimeResourcesUnbalanced('SampleGraphPreview.unmount')`
- Lease release behavior preserved and still safe for stale/no-token paths.

3. `src/runtime/GraphRuntimeLeaseBoundary.tsx`
- Unmount cleanup now calls:
  - `warnIfGraphRuntimeResourcesUnbalanced('GraphRuntimeLeaseBoundary.unmount')`
- Existing lease release behavior preserved.

4. `docs/system.md`
- Added section `2.8 Graph Runtime Cleanup Hardening (2026-02-15)`:
  - patched leak list
  - resource tracker API and usage
  - unmount invariant seam points
  - manual verification checklist

## Why This Completes Step 5 Bedrock
- Shared runtime now has explicit cleanup for highest-risk leak paths.
- DEV guardrails detect imbalance at both preview and graph runtime boundary unmount seams.
- Future regressions become visible without changing production behavior.
