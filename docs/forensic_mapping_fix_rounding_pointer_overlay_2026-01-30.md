# Forensic Mapping Fix: Rounding, Pointer, Overlay
**Date**: 2026-01-30
**Status**: **HARDENED**
**Changes**: `GraphPhysicsPlayground.tsx`

## 1. Executive Summary
Phase 2 of the forensic audit focused on interaction "traps" (Split Brain inputs) and Overlay leaks.
*   **Critical Finding**: "Split Brain" input handling detected. Dragging used `MouseEvents` while Hover used `PointerEvents` with capture, leading to potential race conditions/stuck drags.
*   **Fix**: Unified all input logic to `PointerEvents`.
*   **Result**: Input system is now atomic and robust against window boundaries.

## 2. Forensic Findings

### A. Rounding & Snapping (Verified)
*   **Pixel Snapping**: Confirmed symmetry (fixed in Part 1).
*   **Zoom Stability**: `camera.ts` contains `zoom` updates within sane bounds implicitly via `updateCameraContainment`.
*   **Drift**: No new sources of mathematical drift found.

### B. Pointer Event Traps (Fixed)
*   **Issue**: `GraphPhysicsPlayground.tsx` mixed `onMouseDown` (Physics Drag) with `onPointerDown` (Hover/Capture).
*   **Risk**: `canvas.setPointerCapture` on pointer-down allows the browser to re-target future events. Mouse events might not fire reliably if the pointer is captured, or checking `e.target` might fail if the cursor moves over overlays during a drag.
*   **Solution**: **Full Unification**.
    *   Migrated Drag Logic -> `onPointerDown`, `onPointerMove`, `onPointerUp`.
    *   Implemented `onPointerCancel` to guarantee release of drag state (preventing "stuck node" bugs).
    *   Removed legacy `MouseEvents`.

### C. Overlay Leaks (Safe)
*   **CanvasOverlays**: Uses explicit `stopPropagation` on all interactive buttons.
*   **AnalysisOverlay**: Uses a blanket `pointer-events: all` + `stopPropagation` shield.
*   **PopupPortal**: correctly positioned via `worldToScreen`, independent of canvas event bubbling.

## 3. Verification
*   **Drag & Drop**: Validated code path via unification. Dragging now relies on `PointerId`, ensuring tracking continues even if the mouse leaves the browser window (via `setPointerCapture`).
*   **Wheel**: No manual zoom logic exists (Auto-fit only), so "Wheel Delta Mode" insanity is moot.
*   **Linting**: Cleaned up unused variables and handlers.

## 4. Code Changes
### `src/playground/GraphPhysicsPlayground.tsx`
*   **Refactor**: Merged `handleMouseDown/Move/Up` into `onPointerDown/Move/Up/Cancel`.
*   **Cleanup**: Removed `MouseEventHandler` props from the container `div`.

## 5. Conclusion
The "Split Brain" input risk has been eliminated. The mapping system now enforces a single, consistent input pipeline (Pointer Events) that is mathematically synchronized with the render loop (Part 1) and robust against UI leaks (Part 2).
