# Fix Report: Strict Wheel Ownership
**Date**: 2026-01-30
**Status**: **APPLIED**
**Files**: `src/playground/components/SidebarControls.tsx` (Fixed), `src/playground/components/HalfLeftWindow.tsx` (Verified), `src/fullchat/FullChatbar.tsx` (Verified), `src/components/AnalysisOverlay.tsx` (Verified).

## 1. Executive Summary
We addressed "Ownership" confusion where scrolling a panel would accidentally zoom the canvas, or zooming the canvas would scroll the page.
*   **Panels**: **STRICT WALLS**. All UI panels (Sidebar, Doc Viewer, Chat) now explicitly stop wheel event propagation. They own the scroll; the canvas never sees it.
*   **Canvas**: **EXCLUSIVE**. The canvas accepts wheel events only when directly targeted (or bubbled from non-blocking void), and prevents default page scrolling.
*   **Page**: **BLOCKED**. Global page scroll is inhibited when interacting with the app's interactive areas.

## 2. Root Cause Analysis

### A. Overlay Steals Wheel (Defect 37/39)
*   **Symptom**: Scrolling the Sidebar (Physics Config) zoomed the graph.
*   **Cause**: `SidebarControls` did not have an `onWheel` handler. Wheel events bubbled up to the container. While the Canvas listener is on the `<canvas>` element (sibling), React/DOM event propagation nuances can sometimes cause unexpected fall-through if the pointer target is ambiguous or if the container handled it.
*   **Fix**: Added explicit `onWheel={(e) => e.stopPropagation()}` to `SidebarControls`. Verified `HalfLeftWindow` (`stopWheel` capture), `FullChatbar` (`stopWheel` capture), and `AnalysisOverlay` (`blockEvent`) already had robust protections.

### B. Canvas Steals Wheel (Defect 38)
*   **Symptom**: Zooming the graph scrolled the webpage.
*   **Cause**: Browser default behavior for wheel is to scroll the viewport.
*   **Fix**: (Previously applied in Fix 23, Verified here) `canvas` listener uses `{ passive: false }` and calls `e.preventDefault()`. This guarantees the canvas consumes the event for zoom/pan without triggering page scroll.

## 3. Verification Steps

### Manual Validation
1.  **Sidebar Scroll**: Hover over the physics sliders. Scroll mouse wheel. The sidebar should scroll (if overflowing) or do nothing. The graph **MUST NOT** zoom.
2.  **Doc Viewer Scroll**: Hover over the document text. Scroll. Graph **MUST NOT** zoom.
3.  **Chat Scroll**: Hover over chat messages. Scroll. Graph **MUST NOT** zoom.
4.  **Canvas Zoom**: Hover over empty space / nodes. Scroll. Graph **MUST** zoom. Page **MUST NOT** scroll.

## 4. Conclusion
Wheel routing is now deterministic based on cursor position. No split ownership.
