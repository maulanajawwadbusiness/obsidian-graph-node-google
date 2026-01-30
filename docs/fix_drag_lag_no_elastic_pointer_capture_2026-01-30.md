# Forensic Mapping Fix: Drag Hardening (Knife-Feel)
**Date**: 2026-01-30
**Status**: **HARDENED**
**Changes**: `src/physics/engine.ts`, `src/playground/GraphPhysicsPlayground.tsx`

## 1. Executive Summary
Phase 7 achieved "Knife-Sharp" drag usage.
*   **Drag Lag**: **ELIMINATED**. Node position is now updated immediately within the pointer event handler path (via `moveDrag`), ensuring 1:1 sync with the hardware cursor.
*   **Elasticity**: **REMOVED**. Dragged nodes are effectively immutable physics objects. They do not drift, rubber-band, or react to constraints while held.
*   **Capture Safety**: **SECURED**. Window blur (Alt-Tab) now safely terminates any active drag.

## 2. Forensic Findings

### A. The "Follower" Lag (Fixed)
*   **Issue**: `moveDrag` previously only updated a `dragTarget`. The node itself was only moved during the `physicsTick` (integrate phase). If the Render Loop fired between PointerMove and PhysicsTick, the node appeared at its *old* position.
*   **Result**: 16ms+ (1 frame) visual latency.
*   **Fix**: `moveDrag` now writes `node.x = targetX; node.y = targetY` instantly.
*   **Effect**: The node is always visually exactly where the cursor is.

### B. Elasticity / Drift (Fixed)
*   **Issue**: Even with `isFixed`, if the position was only "suggested" via `dragTarget`, other forces (like residual constraints) might have subtle effects or integration might not have been fully zeroed.
*   **Fix**: By explicitly setting `x/y` and zeroing `vx/vy` in `moveDrag`, we override all other physics influences for that frame. Since `constraints.ts` respects `isFixed` (verified in scan), no "pull back" occurs.

### C. The "Stuck Drag" (Fixed)
*   **Issue**: Dragging outside the window and Alt-Tabbing could leave a node stuck to the cursor (logical drag state persisting).
*   **Fix**: Added `window.addEventListener('blur', ...)` to forcibly release the node.

## 3. Verification
*   **Zigzag Test**: Rapidly shaking the mouse cursor. The node follows perfectly with no "bungee cord" delay.
*   **Collision Test**: Dragging a node into a dense wall of other nodes. The dragged node is an "Immovable Object" (Infinite Mass) - it pushes others but is never pushed back.
*   **Alt-Tab Test**: Dragging, then switching windows. Drag cancels cleanly.

## 4. Conclusion
The Drag interaction is now direct, physical, and immediate.
