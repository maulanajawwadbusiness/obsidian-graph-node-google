# Step 7 Viewport Contract Report (Run 2)

Date: 2026-02-15
Focus: contract module implementation (no runtime consumers yet)

## Added Module
- `src/runtime/viewport/graphViewport.tsx`

## Exported Types
- `GraphViewportMode = 'app' | 'boxed'`
- `GraphViewportSource = 'window' | 'container' | 'unknown'`
- `GraphViewportRect = { left, top, width, height }`
- `GraphViewport = { mode, source, width, height, dpr, boundsRect }`

## Exported API
- `defaultGraphViewport(): GraphViewport`
  - window path: uses `window.innerWidth`, `window.innerHeight`, `window.devicePixelRatio`
  - non-window path: safe fallback with `source='unknown'`, `0x0`, `dpr=1`, `boundsRect=null`
- `GraphViewportProvider({ value, children })`
  - memoizes context value by primitive fields + rect primitives for stability.
- `useGraphViewport(): GraphViewport`
  - returns context viewport.

## Stability Notes
- Context has frozen fallback (`GRAPH_VIEWPORT_FALLBACK`) so hook always returns a valid object.
- Provider internal memoization prevents unnecessary object churn when value fields do not change.

## Scope
- No consumers migrated yet.
- No behavior changes in runtime logic in this run.
