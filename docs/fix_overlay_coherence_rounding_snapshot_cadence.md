# Fix: Overlay Coherence (Rounding, Snapshot, Cadence)

**Date**: 2026-01-30
**Status**: Implemented & Verified

## Problem
Overlays (Node Popups) were "drifting" or "lagging" relative to the canvas rendering because:
1.  **Rounding Mismatch**: Canvas snaps to integers at rest but floats during motion (Phase 6). Overlays were always snapping.
2.  **Snapshot Mismatch**: Overlays calculated position based on potentially stale or live camera refs, not the exact frame snapshot used for rendering.
3.  **Cadence Mismatch**: Overlays often used independent `rAF` loops, causing 1-frame mismatches with the main render loop.

## Solution

### 1. Unified Quantization Policy
We exposed the `snapEnabled` state (calculated by `graphRenderingLoop.ts` based on motion hysteresis) to the `graph-render-tick` event.

- **Idle**: `snapEnabled = true` → `NodePopup` rounds coordinates to device pixels.
- **Moving**: `snapEnabled = false` → `NodePopup` uses raw float coordinates for smooth 1:1 movement.

### 2. Main-Thread Cadence (Event Driven)
We removed any independent update loops in `NodePopup`. It now listens exclusively to `graph-render-tick` dispatched by the main loop.
- **Event Detail**: `{ transform, dpr, snapEnabled }`.
- **Zero Lag**: The event is dispatched *immediately* after the camera update and before the browser paint, ensuring the DOM and Canvas updates land in the same visual frame.

### 3. Shared Snapshot
`NodePopup` uses the `transform` (CameraTransform) passed in the event, which guarantees it projects the world coordinates using the *exact same matrix* as the canvas draw operations for that frame.

## Verification

### Checklist
- [x] **Motion Stickiness**: Dragging the graph rapidly shows the popup pinned to the node center. No rubber-banding.
- [x] **Rest Precision**: When stopping, the popup borders align crisply with the node (verified via `quantizeToDevicePixel` logic).
- [x] **Loop Purity**: `graphRenderingLoop.ts` is the single source of truth for timing using `requestAnimationFrame`.

### Code Changes
- **`renderingTypes.ts`**: Added `snapEnabled` to `RenderTickDetail`.
- **`graphRenderingLoop.ts`**:
    - Fixed imports (`PendingPointerState`, `RenderDebugInfo`).
    - Added `snapEnabled: effectiveSnapping` to event dispatch.
- **`NodePopup.tsx`**:
    - Updated `handleSync` to read `snapEnabled` and conditionally round coordinates.

## Next Steps
- Monitor `[RenderPerf]` to ensure DOM layout thrash from popup updates doesn't exceed budget (currently low risk as valid nodes < 1).
