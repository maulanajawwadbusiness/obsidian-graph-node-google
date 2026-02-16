# Step 5+7 Hardening Run 6 - Pane Viewport Wiring + Provider Widening

Date: 2026-02-16
Run: r6
Scope: graph-screen provider now uses pane snapshot and includes loading gate context scope.

## Changes

Files changed:
- `src/screens/appshell/render/GraphScreenShell.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`

### 1) GraphScreenShell now owns viewport provider

In `GraphScreenShell`:
- imports:
  - `GraphViewportProvider`, `defaultGraphViewport`
  - `useGraphPaneViewportSnapshot`
- computes:
  - `fallbackViewport` via `defaultGraphViewport()` memoized once
  - `graphPaneViewport` via one-shot pane ref snapshot hook
- wraps `children` with:
  - `<GraphViewportProvider value={graphPaneViewport}>...`

Result:
- provider value is pane-derived when ready (`source='container'`), window fallback before first snapshot.

### 2) Removed old graph-screen provider in renderScreenContent

In `renderScreenContent` graph branch:
- removed import and usage of `GraphViewportProvider value={defaultGraphViewport()}` around runtime.
- `GraphRuntimeLeaseBoundary` and `GraphLoadingGate` remain siblings under `GraphScreenShell` children.

Result:
- Because provider is now in `GraphScreenShell` around all children, both:
  - graph runtime subtree
  - `GraphLoadingGate`
  are inside viewport provider scope.

## Behavior guarantee

- No step 8 observer logic added (still one-shot snapshot only).
- Graph screen fallback stays safe via memoized window viewport until pane rect is captured.
