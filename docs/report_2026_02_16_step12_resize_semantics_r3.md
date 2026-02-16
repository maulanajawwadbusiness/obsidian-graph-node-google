# Step 12 Resize Semantics Run 3 - Boxed Resize Integration

Date: 2026-02-16

## Integrated camera-owner resize hook

1. Added camera snapshot read seam in `src/playground/useGraphRendering.ts`:
   - new return API: `getCameraSnapshot()`.
   - snapshot includes `{ panX, panY, zoom }` from live `cameraRef`.

2. Added boxed viewport resize effect in `src/playground/GraphPhysicsPlaygroundShell.tsx`:
   - tracks previous boxed viewport size in ref.
   - runs only when `viewport.mode === 'boxed'` and size actually changes.
   - first measurement is skip-only (initialization guard).
   - computes next camera with `computeCameraAfterResize(...)` using:
     - default mode `DEFAULT_BOXED_RESIZE_SEMANTIC_MODE`
     - previous and next viewport sizes
     - live camera snapshot
     - live rotation snapshot (`engine.getGlobalAngle()`, `engine.getCentroid()`).
   - applies camera only when values differ.

3. Added dev instrumentation calls in resize path:
   - `recordBoxedResizeEvent()` on boxed size change.
   - `recordBoxedResizeCameraAdjust()` only when camera snapshot actually changes.

## Scope discipline

1. Measurement hook (`useResizeObserverViewport`) remains measurement-only.
2. App mode path remains untouched by this effect.
3. No render-loop refactor in this run.

## Notes

For current default semantic (`preserve-center-world`) and current transform stack, many resize events will be no-op camera updates (expected). The contract and integration seam are now encoded for deterministic future policy evolution.

## Verification
- Command: `npm run build`
- Result: pass.
