# Step 12 Resize Semantics Run 1 - Forensic Map

Date: 2026-02-16
Scope: boxed preview resize semantics (camera + viewport interaction)

## Camera State Ownership (current)

Primary camera state owner:
1. `src/playground/useGraphRendering.ts:64`
   - `cameraRef` state: `panX`, `panY`, `zoom`, `targetPanX`, `targetPanY`, `targetZoom`.
2. `src/playground/useGraphRendering.ts:220`
   - `applyCameraSnapshot(...)` mutates both current and target camera values and syncs hover snapshot cache.
3. `src/playground/rendering/graphRenderingLoop.ts:397`
   - per-frame call to `updateCameraContainment(...)` when not dragging.
4. `src/playground/rendering/camera.ts:171`
   - `updateCameraContainment(...)` derives target pan/zoom from world bounds and current viewport width/height.

## Viewport Resize Ownership (current)

Viewport measurement owner:
1. `src/runtime/viewport/useResizeObserverViewport.ts`
   - emits viewport width/height/dpr/boundsRect from container BCR + RO size.
2. `src/components/SampleGraphPreview.tsx:181`
   - boxed preview uses `useResizeObserverViewport(previewRootRef, { mode:'boxed', source:'container' })`.
3. `src/components/SampleGraphPreview.tsx:398`
   - boxed viewport is injected via `GraphViewportProvider`.

## Where viewport size impacts camera math

Direct camera dependence on surface size:
1. `src/playground/rendering/graphRenderingLoop.ts:353-354`
   - `width = rect.width`, `height = rect.height` each frame.
2. `src/playground/rendering/graphRenderingLoop.ts:397-407`
   - `updateCameraContainment(cameraRef, nodes, width, height, ...)` each frame.
3. `src/playground/rendering/camera.ts:206-208`
   - required zoom is recomputed from `safeWidth/safeHeight` every frame.

## Current boxed resize behavior

Observed behavior path:
1. boxed container resize updates viewport context.
2. render loop reads resized canvas rect each frame.
3. containment recomputes target zoom/pan from new width/height.
4. camera target can shift after resize even if user intent was to keep the same center world point and zoom.

So current state does not encode a deterministic boxed-resize contract; it relies on auto-fit containment.

## Step 12 Risks

1. Conflict risk:
   - adding resize semantics without containment policy will be overwritten by per-frame auto-fit.
2. Wrong seam risk:
   - implementing camera semantics in `useResizeObserverViewport` would violate ownership; that hook has no camera access.
3. Determinism risk:
   - if resize handling uses math inconsistent with runtime transform stack, drift or jump can appear.

## Integration seam decision (for next runs)

1. Keep viewport hook as measurement-only.
2. Add pure resize-semantics module under runtime/viewport (contract-level).
3. Integrate camera adjustment in runtime camera owner seam (`GraphPhysicsPlaygroundShell` + `useGraphRendering` API).
4. For boxed default semantic, disable/override auto-fit containment behavior that conflicts with preserve-intent.

## Verification
- Command: `npm run build`
- Result: pass.
