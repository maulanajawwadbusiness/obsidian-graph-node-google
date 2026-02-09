# Report: Render Loop Reattach Fix via Canvas Ready Signal
Date: 2026-02-09

## Summary
Fixed the stale-ref lifecycle bug where render loop could stop during loading and never restart after canvas remount.

Previous patch symptom:
- Logs showed `[RenderLoop] stop` then `[RenderLoop] skipped missing canvas`.
- After loading ended, no `[RenderLoop] start` appeared.

Root cause:
- `useGraphRendering` effect depended on captured `canvasRef.current` value.
- Ref attachment after commit does not force rerender, so effect could miss the remounted canvas.

## Files Changed
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/playground/useGraphRendering.ts`

## Changes
### 1) Callback ref + readiness state
In `GraphPhysicsPlayground`:
- Added `canvasReady` state.
- Added callback ref `setCanvasEl`:
  - writes `canvasRef.current = el`
  - sets `canvasReady` true/false
- Canvas now uses `ref={setCanvasEl}`.

### 2) Effect keyed by readiness signal
In `useGraphRendering`:
- Added `canvasReady` prop.
- Render-loop effect now gates on `canvasReady` + `canvasRef.current` + `engineRef.current`.
- Effect dependency includes `canvasReady` so canvas remount triggers a guaranteed rerun.

## Expected Log Sequence
After analysis completes:
1. `[Graph] loading_exit_remount_canvas`
2. `[RenderLoop] start canvas=...`
3. `[RenderLoop] first_frame`

## Verification
- Build should pass.
- `graph-render-tick` probe should be > 0 after loading exits.
- Graph map should be visible again without manual refresh.
