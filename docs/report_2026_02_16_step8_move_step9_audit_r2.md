# Step 8 Move + Step 9 Audit Run 2 - Movement Aware Origin Refresh

Date: 2026-02-16
Run: r2
Scope: implement movement-triggered viewport origin refresh with bounded settle raf in the viewport hook.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Added movement triggers for position-only changes:
   - `window.scroll` (capture + passive)
   - `window.resize` (passive)
   - `visualViewport.scroll` and `visualViewport.resize` when available
2. Triggers mark position dirty and reuse existing one-pending-rAF scheduler.
3. Added bounded settle loop:
   - when origin changes, settle starts with 8 stable frames required.
   - hard cap at 60 frames to avoid perpetual loops.
   - schedules follow-up flushes only while settling.
4. Strict cleanup:
   - removes all listeners
   - clears settle state
   - cancels pending rAF
   - disconnects observer
5. Resource tracker integration:
   - `graph-runtime.viewport.position-listeners`
   - `graph-runtime.viewport.position-settle-raf`

## Notes

- RO remains size authority.
- Origin remains BCR-derived.
- No permanent polling loop introduced.

## Verification

- `npm run build` passes.
