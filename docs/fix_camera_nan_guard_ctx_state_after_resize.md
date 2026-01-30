# Fix: Camera NaN Guard & Context State Restoration

## Problem Dissected
1.  **NaN Camera Params (`49`)**: Division by zero or invalid math (e.g. log(0)) in camera logic can produce `NaN` for zoom or position. Once `NaN` enters the transform matrix, the canvas renders nothing (blank), and `NaN` propagates to all subsequent frames, requiring a page reload.
2.  **Context State Drift (`50`)**: When the canvas backing is resized (`canvas.width = newW`), the 2D context resets its state (transform becomes identity, styles reset). If we don't explicitly restore the correct transform (scaling by DPR) and styles, the next frame will render at the wrong scale (blurry) or with wrong composition settings.

## Solution Strategy

### 1. Camera Sanitization Guard
We implemented `sanitizeCamera(candidate, fallback)` in `camera.ts`:
- **Checks**: Verifies `panX`, `panY`, `zoom`, `targetPanX`, `targetPanY`, `targetZoom` are finite numbers.
- **Clamps**: Enforces `MIN_ZOOM` (0.05) and `MAX_ZOOM` (50.0).
- **Fallback**: If any check fails, it returns the `fallback` (Last Known Good Camera).
- **Integration**: In the render loop, we sanitize `cameraRef.current` every frame. If it was corrupted, we revert it *before* rendering.

### 2. Context State Canonicalization
We implemented `restoreContextState(ctx, dpr)` in `graphRenderingLoop.ts`:
- **State Reset**:
    - `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`: Ensures correct high-DPI scaling.
    - `ctx.globalAlpha = 1`, `ctx.filter = 'none'`, `ctx.globalCompositeOperation = 'source-over'`.
    - `ctx.imageSmoothingEnabled = true`.
- **Triggers**:
    1.  **Post-Resize**: Immediately after `canvas.width` is set.
    2.  **Frame Start**: At the beginning of every `tick()` to prevent state leakage between frames (e.g. if a previous frame errored out while a clip or transform was active).

## Verification Steps & Observations

### 1. NaN Injection Test
- **Test**: Manually set `cameraRef.current.zoom = NaN`.
- **Observation**: The camera stayed valid (reverted to previous frame). The map did not blank out.

### 2. Context Restore Test
- **Test**: Aggressively resized the window.
- **Observation**: The graph elements remained crisp (DPR scaling applied correctly). No weird offset or blurring occurred.

## Conclusion
The renderer is now robust against numerical instability and state drift. It aggressively creates a "Safe Mode" for both data (camera) and pipeline (ctx state).
