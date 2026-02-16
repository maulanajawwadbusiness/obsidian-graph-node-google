# Step 5+7 Hardening Run 1 - Forensic Pinpoint

Date: 2026-02-16
Run: r1
Scope: identify exact graph-pane measurement seam and provider placement gap.

## Findings

1. The correct graph-screen viewport container is the right pane in `GraphScreenShell`:
- `src/screens/appshell/render/GraphScreenShell.tsx:65`
- Element: `<div className="graph-screen-graph-pane" ...>{children}</div>`
- Why this is correct:
  - It is the structural graph pane (left sidebar pane excluded).
  - It directly wraps the runtime subtree and loading gate children.
  - It is the true surface where graph viewport width/height should be measured for app graph mode.

2. Current provider placement uses a window snapshot and excludes `GraphLoadingGate`:
- `src/screens/appshell/render/renderScreenContent.tsx:102`
  - `<GraphViewportProvider value={defaultGraphViewport()}>`
- `src/screens/appshell/render/renderScreenContent.tsx:128`
  - `GraphLoadingGate` rendered as sibling outside provider.
- Resulting gap:
  - Graph-screen viewport is currently window-based, not pane-based.
  - Future gate/overlay consumers cannot use `useGraphViewport()` while in loading gate.

## Chosen seam for implementation

- Measure pane rect from `GraphScreenShell` using a ref attached to `graph-screen-graph-pane`.
- Move provider ownership into `GraphScreenShell` so both runtime and `GraphLoadingGate` are within provider scope.
- Keep one-shot container snapshot for now; live updates deferred to Step 8.

## Notes

- This approach avoids hooks inside `renderScreenContent` (render helper, not component).
- Minimal diff path: remove provider from `renderScreenContent`, add it in `GraphScreenShell`.
