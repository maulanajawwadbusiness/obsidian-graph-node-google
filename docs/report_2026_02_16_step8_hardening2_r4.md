# Step 8 Hardening Round 2 Run 4 - Listener Hygiene and StrictMode Safety

Date: 2026-02-16
Run: r4
Scope: tighten listener attach/detach symmetry and strictmode-safe cleanup behavior.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Stable listener option objects added:
   - `SCROLL_OPTIONS` (`capture + passive`)
   - `PASSIVE_OPTIONS` (`passive`)
2. Attach/detach symmetry tightened:
   - window listeners, visualViewport listeners, and target interaction listeners now use matching options on add/remove.
3. Visibility listener guard:
   - attach/remove only when `document` is available.
   - visibility handler also guards against missing document.
4. Existing strict bailouts retained:
   - flush exits when target missing or disconnected.
   - effect cleanup keeps observer/listener/raf release order.

## Tracker and lifecycle notes

- Existing tracker seams remain balanced:
  - `graph-runtime.viewport.resize-observer`
  - `graph-runtime.viewport.position-listeners`
  - `graph-runtime.viewport.position-interaction-listeners`
  - `graph-runtime.viewport.resize-raf`
  - `graph-runtime.viewport.position-settle-raf`

## Verification

- `npm run build` passes.
