# Step 8 Resize Observer Run 1 - Forensic Seams and Hook Contract

Date: 2026-02-16
Run: r1
Scope: lock exact replacement seams for live viewport measurement (no behavior changes yet).

## Replacement seams (confirmed)

1. Graph screen one-shot pane snapshot
- `src/screens/appshell/render/GraphScreenShell.tsx:8`
  - imports `useGraphPaneViewportSnapshot`
- `src/screens/appshell/render/GraphScreenShell.tsx:42`
  - computes `graphPaneViewport = useGraphPaneViewportSnapshot(graphPaneRef, fallbackViewport)`
- `src/screens/appshell/render/GraphScreenShell.tsx:71`
  - provides `graphPaneViewport` via `GraphViewportProvider`

2. Preview one-shot boxed snapshot
- `src/components/SampleGraphPreview.tsx:149`
  - local boxed viewport state (`boxedViewport`)
- `src/components/SampleGraphPreview.tsx:312`
  - one-shot `useLayoutEffect` reads `previewRootRef.getBoundingClientRect()` and calls `setBoxedViewport(...)`
- `src/components/SampleGraphPreview.tsx:346`
  - provides boxed viewport via `GraphViewportProvider`

3. Existing one-shot hook module to replace
- `src/runtime/viewport/useGraphPaneViewportSnapshot.ts`
  - current one-shot layout-effect snapshot logic

## Planned hook for Step 8

New hook file:
- `src/runtime/viewport/useResizeObserverViewport.ts`

Proposed signature:
- `useResizeObserverViewport(ref, { mode, source, fallbackViewport? }): GraphViewport`

Core behavior:
1. Use ResizeObserver to track container size changes.
2. Queue updates via a single pending rAF (coalesced max 1 update/frame).
3. Build viewport with int-clamped dims:
   - width/height = `max(1, floor(rect.width/height))`
4. Include boundsRect with raw left/top from DOMRect.
5. Shallow-compare before setState to avoid render churn.
6. Cleanup on unmount:
   - disconnect observer
   - cancel pending rAF
   - disposed guard

Resource tracker integration (dev-only):
- `graph-runtime.viewport.resize-observer`
- `graph-runtime.viewport.resize-raf`

## Step boundary

- This run is forensic only.
- No clamp migration or consumer math changes (Step 9).
