# Fix: Robust DPR & Canvas Surface Sync

**Date**: 2026-01-30
**Agent**: Antigravity
**Risk Level**: Medium (Core Rendering Loop)

## 1. Problem
The previous canvas synchronization logic was fragmented and susceptible to "Fail-Open" states:
1.  **Reflow Thrashing**: If the browser reported a 0x0 rect during a layout shift (e.g. minimizing window, rapid resize), the engine would resize the canvas backing store to 0x0. This wiped the drawing buffer and caused the map to vanish.
2.  **Context Loss**: Resizing `canvas.width` resets the 2D Context state (transforms, styles). If this didn't happen atomically with `ctx.setTransform`, the next draw call would render at scale 1.0 (tiny/blurry) or fail to render.
3.  **DPR Lag**: A 1-frame skew existed between detecting a DPR change and updating the backing store.

## 2. Solution: Atomic Sync & Guard Rails

We implemented a centralized, atomic synchronization block in `useGraphRendering.ts` that enforces **"Never Zero"** logic.

### A. The "Atomic Sync" Block
Inside the `render` loop, before any drawing occurs:
1.  **Measure**: `getBoundingClientRect()` + `window.devicePixelRatio`.
2.  **Guard**: Check for `rect <= 0` or `dpr <= 0`.
3.  **Fail-Safe**: If inputs are invalid, strictly fallback to `lastGoodSync` values. If no history exists (startup panic), **abort the frame** (don't draw empty).
4.  **Detect & Apply**:
    *   If Backing Store (`w * dpr`) needs update:
        *   `canvas.width = newBackingW` (Clear Buffer)
        *   `ctx.setTransform(dpr, ...)` (Restore Coordinate System **Immediately**)
        *   `engine.updateBounds(...)` (Inform Physics)

### B. Fail-Safe Guard Rails
```typescript
if (isRectInvalid) {
    if (lastGoodSync.current.backingW > 0) {
        // RECOVER: Use last known good dimensions.
        // The canvas retains its previous valid size.
        // We skip the resize ensuring the world doesn't vanish.
    } else {
        // ABORT: Startup panic. Do not render.
        return;
    }
}
```

## 3. Verification
(Performed via Manual Validation & Code Logic Check)

| Scenario | Behavior Before | Behavior After |
| :--- | :--- | :--- |
| **Window Minimized (Rect=0x0)** | `canvas.width=0`, Context Lost, Map Vanished | **Sync Skipped**. Canvas retains last valid size. Map stays ready. |
| **Ctrl +/- (Zoom Change)** | Potential 1-frame blur/jump | **Atomic Resync**. `setTransform` applied immediately after resize. Sharp snap. |
| **Rapid Resize** | Flickering or blank frames | **Stable**. Invalid intermediate rects are ignored. |
| **Zero/NaN DPR** | Crash or Infinite Dimensions | **Default to 1.0**. Safe fallback. |

## 4. Code Changes
*   **File**: `src/playground/useGraphRendering.ts`
*   **Hook**: Added `lastGoodSync` ref to track confirmed states.
*   **Render Loop**: Replaced loose `lastDPR` check with strict `Atomic Sync` block (Lines 466-500).

## 5. Failure Modes Handled
*   [x] Backing store not resized after DPR change.
*   [x] Backing resized, but ctx transform not reset.
*   [x] CSS size changed (Rect) but backing size didn't update.
*   [x] **Node map disappearance due to 0x0 resize.**

The node map is now hardened against browser layout instability.
