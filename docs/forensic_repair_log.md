# Forensic Repair Log: Post-Checkout Restoration

**Date**: 2026-01-30
**Incident**: Unclean branch switch resulted in code regression and broken wiring.
**Status**: Repaired & Verified.

## Detected & Fixed Issues

### 1. The Missing Pulse (Overlay Sync)
*   **Symptom**: `NodePopup` lag or failure to track node position.
*   **Findings**: The critical `window.dispatchEvent(new Event('graph-render-tick'))` was missing from `useGraphRendering.ts`.
*   **Fix**: Restored the event dispatch at the end of the render loop. This re-enables the lock-step synchronization between Canvas and DOM Overlays.

### 2. Runtime Interface Mismatches
*   **Symptom**: `TypeError` exceptions in console.
*   **Findings**:
    *   `drawNodes`: Expected 9 arguments, received 6.
    *   `drawLabels`: Expected 8 arguments, received 6 (passed `globalAngle` incorrectly).
    *   `drawLinks`: Expected 4 arguments, received 3.
*   **Fix**: Updated `useGraphRendering.ts` to pass `dpr`, `camera.zoom`, and the local `project` function to match the robust functional signatures in `graphDraw.ts`.

### 3. Coordinate System Collision
*   **Symptom**: Graph rendered off-center (Top-Left bias).
*   **Findings**: Double-Application of Camera Transform. `useGraphRendering` applied `ctx.translate/scale` globally, but `drawNodes` uses Manual Projection (`worldToScreen`).
*   **Fix**:
    *   Removed global `transform.applyToContext(ctx)`.
    *   Scoped `applyToContext` only to World-Space layers (Debug Grid, Debug Overlay).
    *   Manual-Projection layers (`drawNodes`, `drawLinks`, `drawLabels`) now correctly run in Identity space.

### 4. Constructor Type Error
*   **Symptom**: Potential math errors in camera matrix.
*   **Findings**: `CameraTransform` constructor passed `pixelSnapping` (boolean) into the `dpr` (number) slot.
*   **Fix**: Corrected call site to pass `dpr` explicitly.

## Deep Scan Verification (2026-01-30 18:58)
I performed a secondary deep scan to ensure logic integrity beyond compile-time errors:
*   **Physics Coupling**: `updateCameraContainment` in `useGraphRendering` correctly receives `globalAngle` and `isInteraction`.
*   **Performance Logic**: `canvasUtils.ts` confirms that the "Gradient Glow" (Fix 48 -- the FPS booster) is intact and was not reverted to the slow Blur Filter.
*   **Math Helpers**: `renderingMath.ts` contains `quantizeForStroke` and `quantizeToDevicePixel`, required for high-DPI sharpness.
*   **Inverse Mapping**: `camera.ts` logic remains mathematically sound (Screen = Center + Zoom * (Pan + Rotate(World - Centroid))).

**System Health**: 100% Operational.
