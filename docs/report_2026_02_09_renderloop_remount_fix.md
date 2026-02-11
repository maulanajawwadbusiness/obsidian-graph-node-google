# Report: Render Loop Remount Fix After Analysis Loading
Date: 2026-02-09

## Summary
Fixed an edge case where analysis completed but the graph remained invisible because the render loop did not reliably rebind to the remounted canvas after temporary loading-state screen swap.

Observed symptom:
- Interaction and popup still worked.
- Graph map was not visible.
- `graph-render-tick` listener returned `0` events.

## Root Cause
`GraphPhysicsPlayground` can return `LoadingScreen` while AI activity/error is active.
This temporarily unmounts the canvas element.
The render loop effect in `useGraphRendering` was not keyed to canvas element identity, so it could keep a stale canvas reference and fail to restart against the remounted canvas.

## Files Changed
- `src/playground/useGraphRendering.ts`
- `src/playground/rendering/graphRenderingLoop.ts`
- `src/playground/GraphPhysicsPlayground.tsx`

## Changes
### 1) Loop lifecycle keyed to canvas identity
In `useGraphRendering.ts`:
- Added `canvasElement` and `engineElement` capture per render.
- Updated render-loop effect dependencies to include `canvasElement` and `engineElement`.
- Added lifecycle logs:
  - `[RenderLoop] start canvas=...`
  - `[RenderLoop] stop`
  - `[RenderLoop] skipped missing canvas|engine|2d context`

This ensures loop start/stop follows actual mounted canvas instance.

### 2) First-frame proof log
In `graphRenderingLoop.ts`:
- Added one-time log on first successful frame:
  - `[RenderLoop] first_frame`

### 3) Loading-exit remount log
In `GraphPhysicsPlayground.tsx`:
- Added loading transition effect log:
  - `[Graph] loading_exit_remount_canvas`
- Triggered when previous state was loading and current state is not.

## Expected Runtime Sequence
On analysis submit path:
1. Enter loading state -> canvas unmount may occur.
2. Analysis completes -> `[Graph] loading_exit_remount_canvas`.
3. Loop starts on remounted canvas -> `[RenderLoop] start ...`.
4. First frame confirms active draw loop -> `[RenderLoop] first_frame`.

## Verification Checklist
1. Submit analysis from EnterPrompt.
2. Wait until analysis done.
3. Confirm graph appears.
4. Confirm logs sequence above.
5. Optional: run `graph-render-tick` listener check and confirm count > 0 after loading exits.
