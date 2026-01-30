# Repair Report: Input System Hardening
**Date**: 2026-01-30
**Status**: APPLIED
**Focus**: "Visual Dignity" (Zero-Jitter/Lag, Heavy Duty Input Safety)

## 1. Input Sampling Decoupling (Ref 28)
**Goal**: Eliminate "micro-stutter" caused by irregular mouse polling rates (125hz-1000hz) vs Display Refresh (60hz-144hz).
**Issue**: Previously, `onPointerMove` updated the physics engine directly. If the camera panned during a frame *after* the last mouse event, the drag target would lag behind the visual world, causing "vibration".
**Fix**:
*   `GraphPhysicsPlayground.tsx`: `onPointerMove` is now "dumb". It only updates a `pendingPointerRef`.
*   `useGraphRendering.ts`: The `render` loop (rAF) reads the latest pointer position and **re-projects** it to World Space using the *exact* camera matrix used for that frame.
*   **Result**: The dragged node stays locked to the mouse cursor relative to the world, even during high-speed camera pans or complex physics loads.

## 2. Robust Pointer Capture (Ref 29)
**Goal**: Prevent "stuck drags" when the user Alt-Tabs, resizes the window, or moves the mouse off-screen during a specific interaction.
**Fix**:
*   Added `onLostPointerCapture` handler to `GraphPhysicsPlayground`.
*   It explicitly forces a `releaseNode()` and reset of internal state.
*   Updated `onPointerCancel` to guarantee release.
*   **Result**: Drag operations fail safe (terminate cleanly) rather than leaving the node "stuck" to the cursor ghost.

## 3. Wheel Handling & Passive Listeners (Ref 30)
**Goal**: Guarantee `preventDefault` works for Zoom/Pan, preventing the browser from scrolling the page history or document.
**Verification**:
*   `useGraphRendering.ts` explicitly attaches the wheel listener with `{ passive: false }`.
*   Standard React `onWheel` (which can be passive-forced by some browsers) is **bypassed** in favor of the native listener.
*   **Result**: Zooming feels solid and native, with no scrolling leakage.

## Code Changes
*   `src/playground/GraphPhysicsPlayground.tsx`: Input routing logic updates.
*   `src/playground/useGraphRendering.ts`: rAF loop update logic updates.

**Verification**:
*   **Rapid Drag**: Move mouse furiously while panning camera. Node should not "jitter" away from cursor.
*   **Alt-Tab**: Drag node, Alt-Tab away. Node should drop safely.
*   **Zoom**: Scroll wheel on canvas should zoom smooth, page stays still.
