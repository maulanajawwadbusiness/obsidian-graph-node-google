# Step 12 Resize Semantics Run 5 - Docs Contract And Final Audit

Date: 2026-02-16

## Docs contract update

Updated `docs/system.md` with Step 12 section:
1. canonical module and default mode location:
   - `src/runtime/viewport/resizeSemantics.ts`
   - `DEFAULT_BOXED_RESIZE_SEMANTIC_MODE = 'preserve-center-world'`
2. explicit boxed semantics:
   - preserve center-world anchor
   - keep zoom constant across resize
3. integration ownership:
   - measurement remains in `useResizeObserverViewport`
   - camera apply lives in `GraphPhysicsPlaygroundShell` using `getCameraSnapshot` + `applyCameraSnapshot`
4. containment policy note:
   - boxed runtime uses effective lock (`cameraLocked || isBoxedRuntime`) to prevent auto-fit overwrite.
5. dev rails listed:
   - `boxedResizeEventCount`
   - `boxedResizeCameraAdjustCount`

## Final audit summary

1. Resize semantics contract exists as pure module and is integrated at camera owner seam.
2. Boxed runtime resize path is guarded for first-measure and invalid-camera edge cases.
3. App mode behavior remains unchanged.
4. Existing overlay clamp logic remains viewport-dimension based and intact.

## Manual verification checklist (Step 12)

1. In EnterPrompt boxed preview, resize container larger/smaller:
   - no visible camera teleport/jump.
2. Confirm center-world intent remains stable after multiple size toggles.
3. Confirm zoom level does not change across resize operations.
4. Confirm graph screen (app mode) camera behavior is unchanged.

## Verification
- Command: `npm run build`
- Result: pass.
