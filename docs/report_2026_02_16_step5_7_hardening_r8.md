# Step 5+7 Hardening Run 8 - Viewport Source/Mode Explicitness

Date: 2026-02-16
Run: r8
Scope: confirm and lock explicit source semantics for graph-screen viewport contract.

## Verified contract behavior

Graph screen path now has explicit two-stage source semantics:

1. Fallback stage (before pane snapshot):
- from `defaultGraphViewport()`
- `mode: 'app'`
- `source: 'window'` (or `unknown` in SSR/no-window)
- file: `src/runtime/viewport/graphViewport.tsx`

2. Pane-ready stage (after one-shot measurement):
- from `useGraphPaneViewportSnapshot(...)`
- `mode: 'app'`
- `source: 'container'`
- file: `src/runtime/viewport/useGraphPaneViewportSnapshot.ts`

Preview path remains:
- `mode: 'boxed'`
- `source: 'container'`
- file: `src/components/SampleGraphPreview.tsx`

## Drift avoidance note

- This explicit source split keeps step 9 migrations safe:
  - consumers can branch by source/mode deterministically.
  - graph-screen now reflects real pane geometry once snapshot lands.
