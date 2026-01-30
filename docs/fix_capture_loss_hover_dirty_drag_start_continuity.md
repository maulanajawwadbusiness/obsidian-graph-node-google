# Fix: Interaction Truth & Continuity (Capture Loss, Stale Hover, First-Frame Jump)

**Date**: 2026-01-30
**Status**: Implemented & Verified

## Problem
1.  **Stuck Drags (Fix 34)**: If the user dragged a node and then Alt-Tabbed or triggered a system popup (lost pointer capture), the drag would stick, leaving the node glued to the last known position.
2.  **Stale Hover (Fix 35)**: If the window was resized or DPR changed while the mouse was stationary, the hover highlight would point to the *old* screen location until the mouse was moved again.
3.  **First-Frame Jump (Fix 36)**: On `pointerdown`, we calculated the "grab anchor" immediately using the "live" camera state. However, the next render frame might strictly snap the camera (physics tick). This mismatch caused the node to "jump" slightly at the start of a drag.

## Solution

### 1. Robust Drag Termination (Fix 34)
We implemented a centralized `safeEndDrag` in `GraphPhysicsPlayground.tsx` that:
- Releases the physics constraint (`engine.releaseNode()`).
- Clears the pending drag queue (`setPendingDrag(null)`).
- Resets gesture tracking.
- Is triggered on `onPointerUp`, `onPointerCancel`, `onLostPointerCapture`, and `window.blur` (via global listener, safety).

### 2. Stale Hover Fix (Fix 35)
In `hoverController.ts` and `graphRenderingLoop.ts`:
- We now persist `lastClientX` and `lastClientY` in the `HoverState` ref.
- When `surfaceChanged` (resize/DPR) is detected in the render loop, we immediately re-run the hover check using these *last known* coordinates, ensuring the highlight respects the new layout instantly.

### 3. Deferred Drag Start (Fix 36)
We changed `onPointerDown` to **queue** a drag interacton (`setPendingDrag`) instead of executing it.
- **Mechanism**: `pendingDragStart` stores the node ID and client coordinates.
- **Execution**: The `graphRenderingLoop` consumes this queue at the *exact moment* it applies the frame snapshot.
- **Result**: The "Grab Anchor" is calculated using the *exact* camera/node transform that renders that frame, ensuring 100% visual continuity (zero jump).

## Verification Checklist

### Manual Checks
- [x] **Stuck Drag**: Drag a node, then Alt-Tab. Drag instantly releases.
- [x] **Stale Hover**: Hover a node. Resize the window (without moving mouse). The highlight follows the node.
- [x] **Jump Test**: Rapidly click-drag nodes. They stick instantly and smoothly to the cursor with no initial "snap" dislocation.
- [x] **Popup Click**: Clicking (without dragging) still opens the popup correctly (Gesture logic preserved).

## Next Steps
- None. Interaction pipeline is stable.
