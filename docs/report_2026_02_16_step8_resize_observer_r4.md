# Step 8 Resize Observer Run 4 - Graph Pane Wiring

Date: 2026-02-16
Run: r4
Scope: switch GraphScreenShell pane viewport provider to live ResizeObserver updates.

## File changed
- `src/screens/appshell/render/GraphScreenShell.tsx`

## Wiring changes

1. Replaced one-shot hook import:
- removed `useGraphPaneViewportSnapshot`
- added `useResizeObserverViewport`

2. Replaced viewport source computation:
- old:
  - `useGraphPaneViewportSnapshot(graphPaneRef, fallbackViewport)`
- new:
  - `useResizeObserverViewport(graphPaneRef, { mode: 'app', source: 'container', fallbackViewport })`

3. Provider structure unchanged:
- `GraphViewportProvider` still wraps full `children` in graph pane.
- `GraphLoadingGate` remains inside provider scope because it is part of `GraphScreenShell` children.

## Behavior note

- Graph runtime behavior is unchanged except viewport value now stays live when graph pane size changes.
- Fallback remains `defaultGraphViewport()` until live measurement is available.
