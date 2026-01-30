# Fix Report: Disappearing Node Map (DPR Sync Regression)

**Date**: 2026-01-30
**Root Cause**: Timing Hazard in `ResizeObserver` loop.

## 1. The Regression
After implementing the DPR synchronization, the node map (and all canvas content) disappeared from the screen. This was caused by the **ResizeObserver Callback timing**.

### The Failure Sequence (1-Frame Loop)
1.  **Render Loop (rAF)**: Draws the frame correctly.
2.  **Browser Layout**: Determines the canvas size.
3.  **ResizeObserver**: Fires because the container layout or mount event happened.
4.  **The Hazard**: Inside `ResizeObserver`, we called `syncCanvasSizing`. This updated `canvas.width`.
    *   **CRITICAL**: Setting `canvas.width` (the backing store size) **clears the canvas context**.
5.  **Browser Paint**: Occurs immediately after ResizeObserver/Layout.
    *   Result: The user sees the **cleared canvas** (blank).
6.  The loop repeats or settles, but often leaves the user with a blank screen if the observer fires at the wrong time (e.g., continually during a resize/mount).

## 2. The Solution
We removed the **synchronous resizing** from the `ResizeObserver` callback.

### Why this works:
*   The `requestAnimationFrame` loop (already implemented) **polls** `syncCanvasSizing` at the *very start* of every frame.
*   **Order of Operations (Fixed)**:
    1.  **rAF Start**: `syncCanvasSizing` checks bounds. Resizes (clears) if needed.
    2.  **rAF Draw**: We draw the graph *onto* the resized canvas.
    3.  **Layout/Paint**: The browser displays the drawn content.
*   This ensures that any resize happens **before** the draw command for that frame, guaranteeing visibility.

## 3. Verification
*   **ResizeObserver**: Now passive (kept for future "paused mode" hooks, but strictly no-op for sizing).
*   **rAF Polling**: Confirmed active in `useGraphRendering.ts` (L484).
*   **DPR Handling**: Still robust. If user Zooms (Ctrl+/-), `rAF` detects `window.devicePixelRatio` change at start of frame, resizes, and draws.

## 4. Constraint Check
*   No IDE browser used.
*   Forensic scan identified the `clear-after-draw` hazard.
*   Fix is minimal (subtraction of bad code).
