# Fix: Scrollbar/Zoom Stability & Camera Unity

**Date**: 2026-01-30
**Agent**: Antigravity
**Subject**: Interaction/Render Architecture Hardening

## 1. Goal
Address three subtle mapping/stability issues:
1.  **Scrollbar Layout Shifts**: Windows/Linux scrollbars appearing could shift the canvas layout, desyncing the mouse from the nodes.
2.  **Fractional Pixel Alignment**: High-DPI zooms and browser scaling result in fractional `rect.left/top` values. Pre-mature rounding caused 1px jitter.
3.  **Frame Discontinuity**: The input loop (Pointer Events) and Render loop (Canvas) could reference slightly different Camera States (e.g., if physics updated in between), causing "swimming" interactions.

## 2. Solutions

### A. Body Scroll Lock (CSS)
*   **Action**: Enforced `overflow: hidden` on the `body` element.
*   **Result**: The application container is now rigid. Internal panels can scroll (`arnvoid-scroll`), but the root window (and thus the Canvas coordinate origin) is stable. This prevents transient "scrollbar pop" layout shifts.

### B. Frame Snapshot Architecture
*   **Mechanism**: The `useGraphRendering` loop now captures a comprehensive **Frame Snapshot** at the exact moment of rendering.
    ```typescript
    type FrameSnapshot = {
        readonly rect: DOMRect;      // The fractional, stable rect
        readonly dpr: number;        // The device pixel ratio
        readonly camera: CameraState; // FROZEN copy of camera state
        readonly timestamp: number;
    };
    ```
*   **Usage**: 
    *   **Drawing**: Uses snapshot (implicit, as it runs in the same block).
    *   **Hit-Testing**: `onPointerMove` reads `getFrameSnapshot()`.
    *   **Drag Force**: `clientToWorld` uses the *Snapshot's* Camera State, not the live ref.
    *   **Overlays**: `PopupPortal` uses the *Snapshot's* Camera State.
*   **Impact**: It is now mathematically impossible for the Click/Drag target to differ from the Visual target. Even if the physics engine steps 10 times between frames, the input mapping uses the *Visual* state of the last frame, ensuring "What You See Is What You Touch".

### C. Unified API (`effectiveSource`)
*   Refactored `clientToWorld`, `worldToScreen`, and `updateHoverSelection` to accept `DOMRect | FrameSnapshot`.
*   This acts as a "Polyfill": If a snapshot exists (Render is running), it's used. If not (Startup/Unit Test), it falls back to `getBoundingClientRect()`.

## 3. Verification
*   [x] **Scrollbar** toggling no longer shifts the world origin.
*   [x] **Zoom** (Ctrl +/-) handles fractional rects via `FrameSnapshot` propagation without integer jank.
*   [x] **Interaction**: Dragging a node while the physics engine is "hot" (lots of movement) feels solid/locked because the input mapping matches the rendered frame exactly.

## 4. Code Changes
*   `src/index.css`: Added `overflow: hidden`.
*   `src/playground/rendering/hoverController.ts`: Added `FrameSnapshot` type, updated signatures.
*   `src/playground/useGraphRendering.ts`: Implemented `frameSnapshotRef` publication.
*   `src/playground/GraphPhysicsPlayground.tsx`: Consumed `getFrameSnapshot`.
