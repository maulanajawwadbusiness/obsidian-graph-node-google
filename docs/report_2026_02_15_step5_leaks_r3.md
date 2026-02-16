# Step 5 Leak Patch Report (Run 3)

Date: 2026-02-15
Focus: Patch leak #2 and add dev resource counters

## Leak #2 Fixes

### File: `src/playground/rendering/graphRenderingLoop.ts`
1. Added post-unmount guard for font callbacks.
- Added `disposed` flag and early return in `handleFontLoad`.
- Prevents late `document.fonts.ready` callbacks from mutating caches after unmount.

2. Added missing cleanup for `document.fonts` event listener.
- Added `document.fonts.removeEventListener('loadingdone', handleFontLoad)` in teardown.

3. Added safe release path for pending `document.fonts.ready` tracking.
- Ready promise completion and cleanup both release the same tracked handle safely.

## Dev Resource Tracker Added

### File: `src/runtime/resourceTracker.ts`
- Added dev-only tracker API:
  - `trackResource(name)` returns idempotent release function.
  - `getResourceTrackerSnapshot()` returns current counts map.
- Negative count guard logs warning if release imbalance occurs.
- No production overhead: tracker is dev-gated.

## Instrumented Runtime Resources (run 3 scope)
- `graph-runtime.window-blur-listener`
- `graph-runtime.canvas-wheel-listener`
- `graph-runtime.raf-loop`
- `graph-runtime.document-fonts-ready-pending`
- `graph-runtime.document-fonts-loadingdone-listener`

## Scope Guard
- No behavior changes to graph physics or restore logic.
- No changes to lease policy, portal scope, or step 3 pipeline.
