# Fix: Rendering Alignment & Overlay Cadence

**Date**: 2026-01-30
**Agent**: Antigravity
**Focus**: Visual Fidelity (Stroke Crispness, Overlay Lock)

## Problem Statement
1.  **Half-Pixel Blur (22)**: 1px strokes varied between crisp and blurry due to random quantization alignment relative to the device pixel grid.
2.  **Overlay Parallax (23)**: CSS Overlays (Popups) used unquantized float positions, leading to sub-pixel drift relative to Canvas content.
3.  **Overlay Lag (24)**: Overlays trailed the node by 1 frame during motion because they ran on a separate, uncoordinated `requestAnimationFrame` loop.

## Implemented Solution

### 1. Deterministic Stroke Alignment
*   **Module**: `src/playground/rendering/renderingMath.ts`
*   **Logic**: `quantizeForStroke(val, width, dpr)`.
    *   If stroke width is **ODD** in device pixels (e.g. 1px line on 1x screen, 1.5px line on 2x screen?), we snap position to `N + 0.5`.
    *   If stroke width is **EVEN** in device pixels (e.g. 1px line on 2x screen), we snap position to `N.0`.
*   **Application**: `graphDraw.ts` now applies this quantization to node centers `drawNodes` when `pixelSnapping` is enabled.

### 2. Lock-Step Overlay Cadence
*   **Mechanism**: Event-Driven Synchronization.
*   **`useGraphRendering.ts`**: Dispatches a global `window.dispatchEvent(new Event('graph-render-tick'))` immediately after the canvas draw command completes.
*   **`NodePopup.tsx`**: Removed internal `rAF` loop. Added listener for `graph-render-tick`.
*   **Result**: The copy of the DOM Overlay position happens in the **exact same Task** as the Canvas Paint. This eliminates the 1-frame "rAF vs rAF" race condition.

### 3. Overlay Coordinate Quantization
*   **Logic**: `NodePopup.tsx` now rounds the calculated `left/top` CSS values to the nearest device pixel fraction (`round(x * dpr) / dpr`).
*   **Benefit**: Matches the `quantizeToDevicePixel` logic used by the Canvas, ensuring that if a Node is drawn at `100.5`, the Overlay also positions at `100.5`.

## Verification Checks
1.  **Stroke Crispness**: Enable "Pixel Snapping". 1px rings should appear uniformly sharp (2px on Retina), without "shimmering" thickness changes during slow pans.
2.  **Overlay Glue**: Open a popup on a node. Drag the graph violently. The popup should appear "glued" to the node with zero rubber-banding or lag.
3.  **Map Visibility**: Verified that map remains visible (no regressions in rendering loop).

## Notes
*   This approach relies on the browser firing synchronous events fast enough. `CustomEvent` is synchronous.
*   We removed `requestAnimationFrame` from the popup, saving CPU when idle (it only updates when the graph actually renders).
