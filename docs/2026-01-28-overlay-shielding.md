# Overlay Shielding Fix

**Date**: 2026-01-28
**Goal**: Block all interaction with the underlying canvas while the Analysis Overlay is active.

## Problem
The current overlay has `pointer-events: all`, which blocks mouse clicks and hovers. However, scroll wheel events and some pointer gestures might bleed through to the canvas, causing the graph to zoom or pan during analysis.

## Solution
1.  **Block Pointing**: Ensure `pointer-events: auto` (or `all`) is set on the container.
2.  **Block Scrolling**: Add `onWheel` handler that calls `stopPropagation()` and `preventDefault()`.
3.  **Block Dragging**: Add `onMouseDown`, `onMouseMove`, `onMouseUp`, `onTouchStart`, `onTouchMove` handlers that stop propagation.

## Implementation Data
*   **File**: `src/components/AnalysisOverlay.tsx`
*   **Style**:
    *   `zIndex: 2000` (already set)
    *   `pointerEvents: 'all'` (already set)
*   **New Handlers**:
    ```typescript
    const blockEvent = (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    ```

## Verification
*   Drop file -> Overlay appears.
*   Try to scroll wheel -> Canvas should NOT zoom.
*   Try to drag -> Canvas should NOT move.
*   Try to click node -> Popup should NOT open.
