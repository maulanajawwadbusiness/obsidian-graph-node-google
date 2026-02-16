# Step 8 Resize Observer Run 2 - Hook Implementation

Date: 2026-02-16
Run: r2
Scope: add reusable ResizeObserver viewport hook (no callsite wiring yet).

## Added

New file:
- `src/runtime/viewport/useResizeObserverViewport.ts`

API:
- `useResizeObserverViewport(ref, { mode, source, fallbackViewport? }) => GraphViewport`

## Behavior implemented

1. Live container measurement
- Uses `ResizeObserver` on `ref.current`.
- Also performs initial read from `target.getBoundingClientRect()`.

2. rAF batching
- Resize callback stores latest rect in ref.
- Schedules max one pending rAF (`pendingRafIdRef`) to flush state.
- Multiple observer callbacks in same frame coalesce into one update.

3. Stable update guard
- Computes next viewport from latest rect.
- Uses shallow compare (`sameViewport`) and only calls `setViewport` when values changed.

4. Numeric safety
- Width/height are `floor(...)` and clamped `>=1`.
- DPR is normalized with min `0.1` fallback.

5. Cleanup safety
- On unmount:
  - cancel pending rAF
  - release tracker handle for pending rAF
  - disconnect observer
  - release observer tracker handle
- disposed guard blocks post-unmount state writes.

6. Dev tracker integration
- Tracks observer lifetime with:
  - `graph-runtime.viewport.resize-observer`
- Tracks pending frame lifetime with:
  - `graph-runtime.viewport.resize-raf`

## Notes

- No consumer migration yet in this run.
- Existing one-shot hooks remain in use until runs 3 and 4.
