# Step 8 Resize Observer Run 5 - Cleanup, Docs, Invariants

Date: 2026-02-16
Run: r5
Scope: finalize live viewport measurement, retire one-shot hook, and document invariants.

## Code cleanup

1. Removed obsolete one-shot pane hook:
- deleted `src/runtime/viewport/useGraphPaneViewportSnapshot.ts`
- graph-screen now fully uses `useResizeObserverViewport`

2. Added cleanup guardrail in live hook:
- file: `src/runtime/viewport/useResizeObserverViewport.ts`
- dev-only warning once if pending rAF ever remains after cleanup path:
  - `[ViewportResize] pending rAF remained after cleanup`

3. Resource tracker naming confirmed for leak detection:
- `graph-runtime.viewport.resize-observer`
- `graph-runtime.viewport.resize-raf`

## Docs update

Updated `docs/system.md` section `2.10 Graph Viewport Contract`:
- step status now reflects step 8 live wiring
- graph-screen + preview both use ResizeObserver live updates
- rAF batching, int-clamp, cleanup semantics documented
- step boundary clarified (step 9 still pending consumer/clamp migration)
- checklist expanded with live resize + tracker invariants

## Final invariants for step 8

1. Live updates on container resize for both app graph pane and boxed preview.
2. Coalesced to max one state flush per frame.
3. width/height always int-clamped and `>=1`.
4. observer and rAF cleanup on unmount with dev tracker visibility.
