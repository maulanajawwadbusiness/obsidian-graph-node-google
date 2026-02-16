# Step 5+7 Hardening Run 4 - Pane Snapshot Hook (One-Shot)

Date: 2026-02-16
Run: r4
Scope: add container-based viewport snapshot helper for graph-screen app mode.

## Changes

New file:
- `src/runtime/viewport/useGraphPaneViewportSnapshot.ts`

Added hook:
- `useGraphPaneViewportSnapshot(paneRef, fallbackViewport)`

Behavior:
- starts from fallback viewport (defaults to `defaultGraphViewport()`)
- performs one-shot `getBoundingClientRect()` in `useLayoutEffect`
- emits app-mode viewport with container source:
  - `mode: 'app'`
  - `source: 'container'`
  - `width/height` clamped to `>=1`
  - `boundsRect` from pane rect snapshot
  - `dpr` from current window DPR fallback
- includes unmount guard so state is not updated after dispose.

## Why this fits step scope

- one-shot snapshot only (no ResizeObserver yet)
- SSR-safe fallback path remains through `defaultGraphViewport()`
- no consumer migration yet; this is plumbing for run 6 provider wiring.
