# Fix Report: Pointer Routing & Capture Stabilization
**Date:** 2026-01-31
**Agent:** Antigravity

## 1. Problem Description
The user reported that dragging nodes was "still broken" despite previous lock fixes, with symptoms suggesting pointer events were either not firing or being lost (e.g., sticking, or not starting when clicking near overlays).

Forensic analysis and audit revealed:
1.  **Strict Target Gating**: The code explicitly checked `if (e.target !== canvas) return;`. This meant that clicking on any overlay element (even if transparent or a UI label) would fail to initiate a drag, even if it bubbled up to the handler.
2.  **Brittle Capture Target**: Capture was set on the `canvas` element, but the event listeners were on the parent `div`. While this often works, it relies on event bubbling consistency. If the pointer leaves the window, `lostpointercapture` might fire on the canvas but not bubble correctly to the div listener in some edge cases.
3.  **Missing Default Prevention**: The container lacked `user-select: none`, allowing text selection to trigger during drags (which interrupts pointer events).

## 2. Changes Applied

### A. Relaxed Target Gating (`GraphPhysicsPlayground.tsx`)
Removed the strict `e.target === canvas` check.
Changed to:
- Listen on the container `div`.
- Allow events from children to bubble up.
- Rely on `updateHoverSelection` to perform the geometric hit test to decide if a node was clicked.
- `e.currentTarget` (The Div) is now the authoritative source for capture.

### B. Robust Capture (`GraphPhysicsPlayground.tsx`)
- switched `setPointerCapture(id)` to be called on `e.currentTarget` (the Div) instead of `canvasRef.current`.
- Added try/catch around capture calls to prevent errors from aborting the handler.
- Explicitly verified `hasPointerCapture` in logs.

### C. Browser Default Prevention (`graphPlaygroundStyles.ts`)
- Added `userSelect: 'none'` to `MAIN_STYLE`.
- Confirmed `touchAction: 'none'` exists.

## 3. Verification Instructions

### Test A: Overlay Click
1.  If there is a UI element (like a label or debug text) *over* a node.
2.  Click and drag starting *on* the text.
3.  **Expected**: The node underneath is grabbed and dragged. (Previously: ignored).

### Test B: Off-Canvas Release
1.  Drag a node off the edge of the canvas/window.
2.  Release the mouse button while outside.
3.  **Expected**: The drag ends cleanly (node stops following). `[PointerTrace] Up` log appears.

### Test C: Text Selection
1.  Drag aggressively across the screen.
2.  **Expected**: No blue text selection highlight appearing on UI text.

## 4. Risks
*   **UI Button Interaction**: If a UI button inside the container does not `stopPropagation()`, clicking it might trigger a node hit-test behind it.
    *   *Mitigation*: UI components (`SidebarControls`, `CanvasOverlays`) are generally absolutely positioned or handle their own events. The forensic logs will reveal if "ghost clicks" occur on buttons.

