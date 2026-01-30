# Forensic Report: Screen ↔ World Mapping
**Target**: `src/playground/rendering/camera.ts` & Coordinate Systems
**Date**: 2026-01-30
**Status**: ACQUIRED

## 1. The Core Mechanism
The mapping between 2D Screen Space and 2D World (Physics) Space is governed by a **Single Source of Truth**: the `CameraTransform` class.

*   **Location**: `src/playground/rendering/camera.ts`
*   **Role**: Unifies Input (Mouse/Touch) and Output (Canvas Drawing) into a single mathematical authority.
*   **Principle**: "Visual Dignity" — The user's hand and the renderer must agree 1:1.

## 2. Coordinate Pipeline (Dissection)
The transformation stack is applied in specific orders depending on direction.

### A. Render Path (World -> Screen)
When the `useGraphRendering` loop draws the frame, it applies the transform to the Canvas Context.
**Order of Operations**:
1.  **Center Screen**: `ctx.translate(width/2, height/2)`
    *   *Effect*: (0,0) moves to the middle of the viewport.
2.  **Zoom**: `ctx.scale(zoom, zoom)`
    *   *Effect*: World units are multiplied by zoom level.
3.  **Pan**: `ctx.translate(panX, panY)`
    *   *Effect*: The "Camera" moves around the world. (Note: implementation treats pan as an offset to the world origin).
4.  **Rotation (Centroid-Relative)**:
    *   `ctx.translate(cx, cy)`
    *   `ctx.rotate(angle)`
    *   `ctx.translate(-cx, -cy)`
    *   *Effect*: The entire world rotates around the graph's centroid.

### B. Input Path (Screen -> World)
When a pointer event occurs (`GraphPhysicsPlayground.tsx`), `clientToWorld` reverses the stack exactly.
**Order of Operations (Inverse)**:
1.  **Normalize**: `screenX - rect.left - rect.width/2`.
    *   *Result*: Pixels relative to screen center.
2.  **Un-Zoom**: `screenX / zoom`.
    *   *Result*: World units (but still centered).
3.  **Un-Pan**: `worldX - panX`.
    *   *Result*: World coordinates (rotated).
4.  **Un-Rotate**: Inverse rotation matrix around centroid.
    *   *Result*: **True World Coordinates**.

## 3. Mathematical Hardening (The "Snap" Layer)
To prevent "Slush" (visual jitter or drift), the system employs three layers of hardening in `camera.ts`:

### 1. The Deadzone (Fix #1)
In `updateCameraContainment`, the camera target is **not updated** unless the change exceeds **0.5px**.
*   **Why**: Floating point noise + High DPI screens = incessant sub-pixel "shimmer".
*   **Code**: `if (Math.abs(diff) > 0.5) update()`

### 2. Tail Snapping (Fix #2)
The camera lerps (eases) to its target. Lerp functions mathematically never reach their destination (Zeno's Paradox).
*   **The Fix**: If distance < **0.05px**, we force `camera.pos = target.pos`.
*   **Why**: Prevents "eternal rendering" — the loop can actually rest when the camera is still.

### 3. Pixel Snapping (Optional Fix #5)
If `pixelSnapping=true`, `panX` and `panY` are rounded to the nearest integer relative to the zoom level.
*   **Code**: `pan = Math.round(pan * zoom) / zoom`
*   **Why**: Ensures lines are drawn on clear pixel boundaries, avoiding anti-aliasing fuzz on straight lines.

## 4. System Integration & Overlap
The mapping system does not exist in a vacuum. It connects deeply with:

1.  **The Scheduler (`useGraphRendering.ts`)**:
    *   The Camera is stateful (`useRef<CameraState>`).
    *   It is updated **every frame**, independent of physics ticking.
    *   This ensures 60fps scrolling even if the physics engine (node movement) is degrading to 20fps under load.

2.  **The Physics Engine (`engine.ts`)**:
    *   The Camera "follows" the physics nodes (`updateCameraContainment`).
    *   It calculates the AABB (Bounding Box) of all nodes and smoothly zooms to fit them.
    *   **Coupling**: Physics drives Camera Target -> Camera Lerps -> Render.

3.  **Interactions (`GraphPhysicsPlayground.tsx`)**:
    *   **Pointer Capture**: `canvas.setPointerCapture` is used to lock the mouse to the canvas during drag.
    *   **Layering**: The mapping accounts for the `CanvasOverlays` and DOM hierarchy via `getBoundingClientRect()`.

## 5. Potential Issues (Diagnostics)

*   **Centroid Drift**: The rotation logic relies on `centroid`. If the physics engine calculates a "jitters" centroid (e.g., oscillating nodes), the entire screen will shake.
    *   *Mitigation*: The Deadzone (0.5px) usually absorbs this.
*   **Scale Limits**: Extreme zoom levels (near 0) could cause singularity in `.scale()`.
    *   *Mitigation*: `requiredZoom` is capped.
*   **Event Passthrough**: DOM overlays (`CanvasOverlays`) sit *on top* of the canvas.
    *   *Handling*: `pointer-events: none` is critical on overlay containers, while buttons have `pointer-events: auto`.

## 6. Implementation Summary
The `CameraTransform` is a robust, bidirectional translator that prioritizes **stability** (via deadzones/snapping) over **raw precision**. It effectively decouples the "Smooth View" from the "Noisy Physics".
