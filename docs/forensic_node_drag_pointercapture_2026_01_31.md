# Forensic Report: Node Drag & Pointer Capture Analysis
**Date:** 2026-01-31
**Agent:** Antigravity
**Subject:** Deep Scan of Node Drag Architecture and Event Flow

## 1. Summary
A forensic investigation of the node drag subsystem was conducted to verify reports of "dead" drag functionality. The analysis traced the full event path from React pointer events to the physics engine cycle. The logic flow appears structurally correct in the source code following the recent wiring fixes, but several potential fragility points were identified that could cause silent failure, particularly around `updateHoverSelection` missing its spatial index and the "Deferred Drag" mechanism relying on frame-perfect synchronization.

## 2. Event Flow & Logic Trace
The intended drag architecture (Deferred Drag) operates as follows:

1.  **Input (UI Thread)**: `onPointerDown` (GraphPhysicsPlayground)
    *   Calls `canvas.setPointerCapture` (Verified: wired).
    *   Calls `updateHoverSelection` to locate node (Verified: wired).
    *   Calls `handleDragStart` if node found (Verified: wired).
2.  **State Transition**: `handleDragStart` (useGraphRendering)
    *   Calls `engine.lockInteraction('drag')` to freeze optimization levels.
    *   Sets `pendingPointerRef.current.pendingDragStart` = `{ nodeId, x, y }`.
3.  **Consumption (Render Thread)**: `startGraphRenderLoop` (graphRenderingLoop)
    *   Runs `render()` on RAF.
    *   Checks `pendingPointerRef.current.pendingDragStart`.
    *   Calls `engine.grabNode`.
4.  **Physics (Engine)**: `grabNode`
    *   Sets `draggedNodeId`.
    *   Sets `node.isFixed = true`.
5.  **Synchronization**: `applyDragTargetSync` (Loop)
    *   Reads `cursorClientX/Y` from `hoverStateRef`.
    *   Mapping `clientToWorld`.
    *   Calls `engine.moveDrag`.

## 3. Findings per Component

### A. GraphPhysicsPlayground.tsx (Input Layer)
*   **Status**: **WIRED**.
*   **Observation**: `onPointerDown` explicitly checks `e.target === canvas`. This is robust but brittle if any transparent overlays capture the click. The logic `if (DRAG_ENABLED) { handleDragStart(...) }` is correct.
*   **Risk**: `updateHoverSelection` is called without `renderScratch`. This forces an `O(N)` fallback search every click. If `engine.nodes` is large, this is slow, but functional. If `updateHoverSelection` fails (returns null hit), drag never starts.

### B. useGraphRendering.ts (State Bridge)
*   **Status**: **WIRED**.
*   **Observation**: `handleDragStart` correctly populates the pending ref. `pendingPointerRef` is stable across renders.

### C. graphRenderingLoop.ts (Consumer)
*   **Status**: **WIRED**.
*   **Observation**: The loop checks `pendingDragStart` at the *very top* of the render function (Line 834). This ensures the drag is picked up on the next frame.
*   **Risk**: The loop depends on `clientToWorld` being accurate. `clientToWorld` uses `cameraRef.current`. Since `onPointerDown` (Input) and `render` (Loop) run on the same thread (JS), there is no race condition on the Ref value itself.

### D. PhysicsEngine.ts (Core)
*   **Status**: **WIRED**.
*   **Observation**: `grabNode` correctly sets `isFixed`. `lockInteraction` correctly sets the lock.

## 4. Root Cause Analysis (Likely Suspects)
Since the code *appears* correct, the failure is likely due to one of these subtle runtime factors:

1.  **Hit Detection Miss**: If `updateHoverSelection` (O(N) fallback) fails to find the node during `onPointerDown`, `hitId` is null, and `handleDragStart` is never called. This could happen if coordinate mapping (`clientToWorld`) is slightly off or if the node radius is too small for the hit test.
2.  **Pointer Capture Loss**: If `canvas.setPointerCapture` throws or is immediately lost (e.g. to a parent element or browser behavior), `onPointerUp` might fire prematurely, calling `handleDragEnd` immediately.
3.  **Overlay Blocking**: If `CanvasOverlays` or another div covers the canvas (even transparently), `e.target !== canvas` check filters out the event, causing a "Click-Through" failure where the user thinks they are clicking the canvas but are clicking a container.

## 5. Minimal Fix Plan
Do **NOT** implement complex logic changes. The current architecture is sound.

1.  **Verify Hit**: Add console logging in `GraphPhysicsPlayground.tsx` inside `onPointerDown` to confirm `hitId` is found.
2.  **Relax Target Check**: Remove or soften the `if (e.target !== canvas)` check to allow events bubbling from transparent overlays if necessary.
3.  **Pass RenderScratch**: (Optional perf fix) Pass `renderScratchRef.current` to `updateHoverSelection` in `GraphPhysicsPlayground` (requires modifying hook return).

## 6. Risk Notes
*   **Stuck Interaction Lock**: If `handleDragEnd` is not called (e.g. unexpected error path), the engine remains in "Drag Mode" (no sleep/degrade). The `safeEndDrag` wiring via `onLostPointerCapture` mitigates this, but robust error handling is key.
*   **O(N) Fallback**: The current click detection is technically O(N). For 5000 nodes, this might cause a micro-stutter on click, but shouldn't break functionality.

