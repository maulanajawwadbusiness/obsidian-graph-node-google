# Step 5+7 Hardening Run 9 - System Docs Update

Date: 2026-02-16
Run: r9
Scope: update canonical system docs for tracker hardening and pane-derived app viewport provider scope.

## File updated
- `docs/system.md`

## Documentation changes

1. Section `2.8 Graph Runtime Cleanup Hardening`
- Added dev tracker hardening truth:
  - negative counts are blocked (clamp to zero)
  - invalid decrements warn once per resource with short stack excerpt
  - unbalance warnings deduped once per source to avoid log spam

2. Section `2.10 Graph Viewport Contract`
- Replaced outdated graph-screen wiring note (provider in `renderScreenContent`) with current truth:
  - provider owner is now `GraphScreenShell`
  - source seam is `graph-screen-graph-pane`
  - one-shot pane rect snapshot via `useGraphPaneViewportSnapshot`
  - fallback source is window/unknown until pane snapshot lands
  - provider scope includes both runtime and `GraphLoadingGate`

## Outcome

- Docs now match current implementation state and future step-8/step-9 assumptions.
