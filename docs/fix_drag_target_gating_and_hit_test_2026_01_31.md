# Fix Report: Stale Pointer Coordinates & Target Gating
**Date:** 2026-01-31
**Agent:** Antigravity

## 1. Problem Description
Users reported that after successfully "grabbing" a node, it would not follow the pointer (drag didn't move).
Forensic analysis revealed two issues:
1.  **Stale Pointer Coordinates**: The render loop (`graphRenderingLoop.ts`) detected that mouse input was pending, but `updateHoverSelectionIfNeeded` was passing `hoverStateRef.current.lastClientX` (the *old* position) to the update function instead of reading `pendingPointerRef.current` (the *new* position). This caused the internal "cursor" to stay frozen at the drag start location.
2.  **Target Gating**: (Addressed in previous turn) Strict `e.target !== canvas` checks prevented interaction with overlays.

## 2. Changes Applied

### A. Fix Stale Pointer Usage (`graphRenderingLoop.ts`)
Updated `updateHoverSelectionIfNeeded` to accept the full `pendingPointerState` object.
Logic changed to:
```typescript
if (hasPending) {
    targetX = pendingPointerState.clientX; // READ FRESH
    targetY = pendingPointerState.clientY;
    pendingPointerState.hasPending = false; // CONSUME
}
```
This ensures that every mouse move processed by the render loop actually updates the hover cursor position, which `applyDragTargetSync` then uses to move the node.

### B. Verify Target Gating (`GraphPhysicsPlayground.tsx`)
Confirmed that `onPointerDown` now uses `e.currentTarget` (relaxed check), allowing drags to start even if clicking on a label or overlay.

## 3. Verification Instructions

### Test A: Drag Follow
1.  Grab a node.
2.  Move mouse.
3.  **Expected**: Node follows the mouse cursor fluidly.

### Test B: Overlay Drag
1.  Grab a node *through* a text label.
2.  **Expected**: Node grabs and follows.

## 4. Risks
*   **None identified**. The change essentially connects the "pipe" between the input handler and the render loop, which was broken.

