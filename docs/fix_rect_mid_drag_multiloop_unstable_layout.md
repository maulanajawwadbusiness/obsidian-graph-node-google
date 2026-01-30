# Fix: Rect Mapping & Stability (Mid-Drag/Multi-Loop)

**Date**: 2026-01-30
**Agent**: Antigravity
**Risk Level**: Medium (Interaction Layer)

## 1. Problem
The graph interaction layer had three "Coordinate Drift" vulnerabilities:
1.  **Multi-Loop Split Brain**: The Main Render loop and the Popup/Overlay loop ran asynchronously and both called `getBoundingClientRect()`. During a window resize or panel toggle, they would get different values in the same frame slice, causing overlays to "vibrate" or drift relative to nodes.
2.  **Transient Rects**: During complex layout reflows (e.g. Flexbox settling), the browser may report a `0x0` or intermediate rect for 1 frame. This caused the map to vanish or flash.
3.  **Mid-Drag Discontinuity**: Changing the window size while dragging caused the user's cursor to desync from the node, making the node jump visually.

## 2. Solution: Single Truth & Stability Filter

We implemented a **"Surface Snapshot"** architecture.

### A. The "Surface Snapshot" (Single Source of Truth)
*   **Mechanism**: The Main Render Loop acts as the *only* authority on the Canvas geometry.
*   **Storage**: A `surfaceSnapshotRef` stores `{ rect, dpr, timestamp, frameId }`.
*   **Consumption**: Event handlers (PointerMove) and Overlays (Popups) now read `getSurfaceSnapshot()` instead of polling `getBoundingClientRect()` themselves.
*   **Impact**:
    *   **Zero Jitter**: Popups and Nodes are now mathematically locked to the exact same coordinate system frame-by-frame. I.e. "If the node is at (100,100) on the canvas, the popup is at (100,100) on the overlay."

### B. Rect Stability Filter (Debounce)
*   **Logic**: A new `rect` is only accepted as "Truth" if it remains stable for **2 consecutive frames** (or if it's the first valid frame).
*   **Transient Protection**: If the browser spits out a `300x0` rect during a reflow, the filter rejects it and the renderer continues to use the *Last Good Rect*. The user sees a frozen frame for ~16ms instead of a white flash.

### C. Drag Continuity
*   **Implicit Fix**: By forcing `onPointerMove` to use the **same** snapshot rect as the `render` loop, we ensured that the `clientToWorld` projection used for determining drag force always matches the visual camera projection.
*   **Result**: Even if the layout reflows, the node "sticks" to the mouse cursor's relative position in the world.

## 3. Code Changes
*   `src/playground/useGraphRendering.ts`:
    *   Added `surfaceStabilityRef` (Debounce logic).
    *   Added `surfaceSnapshotRef` (Publication logic).
    *   Exported `getSurfaceSnapshot`.
*   `src/playground/GraphPhysicsPlayground.tsx`:
    *   Refactored `onPointerMove`, `onPointerDown`, and `PopupPortal` to use `getSurfaceSnapshot()`.

## 4. Verification Check
| Scenario | Behavior Before | Behavior After |
| :--- | :--- | :--- |
| **Resize during Drag** | Node jumps or drifts | Node sticks to cursor (Single Truth) |
| **Panel Toggle** | Popups jitter/vibrate | Popups locked to nodes |
| **0x0 Layout Glitch** | Map vanishes (ClearRect) | Frame skip (Map stays visible) |
