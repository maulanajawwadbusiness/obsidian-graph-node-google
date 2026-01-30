# Forensic Report: DPR, Browser Zoom & Canvas Sync

**Date**: 2026-01-30
**Subject**: Analysis of Device Pixel Ratio (DPR), Canvas Backing Store, and Coordinate Mapping Integrity.
**Constraint**: Investigation only. No code changes.

## 1. Executive Summary

The application implements a **Polling & Reactive** strategy for DPR and Layout Sync. It does not rely on event listeners (`resize` or `matchMedia`) for its core loop, ensuring high robustness but potentially incurring performance costs (Reflow Thrashing).

**Top 5 Risks / Failure Modes Identified:**
1.  **Double Reflow Thrashing**: `NodePopup.tsx` and `useGraphRendering.ts` **both** call `getBoundingClientRect()` in independent `requestAnimationFrame` loops. This forces the browser to recalculate layout twice per frame if the DOM is dirty.
2.  **The "Stretchy Frame" (1-Frame Lag)**: The `render` loop detects `dpr !== lastDPR` *inside* the draw call. The canvas resize happens synchronously, but if the browser's paint cycle is tight, there may be a single frame where the visual scale is applied to the old backing store size before the resize takes effect (though `ctx.setTransform` mitigates this visually).
3.  **Interaction "Hand-off" Jitter**: `hoverController` relies on `pendingPointer` or last known `cursorClientX`. If the window resizes (layout shift) *without* a mouse move event, the `clientToWorld` calculation uses the *old* mouse client coordinates with the *new* canvas rect. This is mathematically correct (mouse didn't move relative to viewport), but visually the graph under the mouse might jump if the camera framing doesn't perfectly compensate.
4.  **Pixel Snapping Mismatch**: `CameraTransform` snaps `panX/Y` to `1/zoom` intervals (Visual Pixels). On High-DPI (Retina, DPR=2), this aligns to *CSS Points*, not *Device Pixels*. This means we are effectively ignoring the sub-pixel precision available on high-res screens, rendering at "Standard Definition" alignment even on "High Definition" buffers.
5.  **Popup Race Condition**: `NodePopup` uses an independent `rAF` loop. If `useGraphRendering` updates the physics simulation (node positions) *after* the Popup loop runs but *before* the screen paints, the Popup will trail the node by 1 frame (16ms lag).

## 2. System Map

### A. The Source of Truths (Variables)

| Variable | Source | Frequency | Consumer | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **`dpr`** | `window.devicePixelRatio || 1` | Every Frame | `useGraphRendering.ts` (L467) | Polled directly. No event listener. |
| **`rect`** | `canvas.getBoundingClientRect()` | Every Frame | `useGraphRendering.ts` (L466), `GraphPhysicsPlayground` (Events) | **Performance Hotspot**. Called multiple times per frame. |
| **`canvas.width`** | `rect.width * dpr` | On Change | `useGraphRendering.ts` (L480) | Backing store size. Resets context state. |
| **`lastDPR`** | `useRef` | N/A | `useGraphRendering.ts` | Used to detect diffs. |
| **`scale`** | `ctx.setTransform(dpr, ...)` | Every Frame | `useGraphRendering.ts` (L487) | syncs Context CTM to Backing Store. |

### B. Call Graph: Input Mapping (`clientToWorld`)

```mermaid
graph TD
    A[PointerEvent (Move/Down)] --> B[GraphPhysicsPlayground]
    B --> C[useGraphRendering / hoverController]
    C --> D[clientToWorld(clientX, clientY, rect)]
    D --> E[CameraTransform.clientToWorld]
    E --> F[Unapply Zoom/Pan/Angle]
    F --> G{Active Drag?}
    G -- Yes --> H[Fix 55: Re-project using FRESH rect]
    G -- No --> I[Standard Hit Test]
```

### C. Call Graph: Overlay Projection (`worldToScreen`)

```mermaid
graph TD
    A[NodePopup (rAF Loop)] --> B[trackNode(nodeId)]
    B --> C[GraphPhysicsPlayground Callback]
    C --> D[canvas.getBoundingClientRect() ⚠️]
    C --> E[worldToScreen(node.x, node.y, rect)]
    E --> F[CameraTransform.worldToScreen]
    F --> G[Return Screen Coords]
    G --> H[Popup.style.left/top Update]
```

## 3. Deep Dive: Critical Paths

### Path 1: The Resync Logic (`useGraphRendering.ts`)
```typescript
const dpr = window.devicePixelRatio || 1;
const rect = canvas.getBoundingClientRect(); // ⚠️ Reflow
const displayWidth = Math.round(rect.width * dpr);
...
if (dpr !== lastDPR.current || sizeChanged) {
    canvas.width = displayWidth; // ⚠️ Clears Context
    engine.updateBounds(...);
}
ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // ⚠️ Restore Logic
```
*   **Verdict**: **Solid but Brute-Force**. It guarantees correctness by checking every frame. It recovers from `canvas.width` clearing the context by explicitly calling `setTransform` immediately after.

### Path 2: Interaction Lock (`Fix 55`)
```typescript
if (engine.draggedNodeId && hasPointer) {
    const { x, y } = clientToWorld(cursorClientX, cursorClientY, rect);
    engine.moveDrag({ x, y });
}
```
*   **Verdict**: **Hardened**. Even if the browser zooms (changing `rect` and `dpr`), this block runs *after* the resize logic in the same frame. The `rect` passed to `clientToWorld` matches the visual state. The drag will not drift.

### Path 3: The Overlay Split-Brain
*   **Problem**: `NodePopup.tsx` has its own `requestAnimationFrame` loop (L216-233) to drive the smooth follow.
*   **Risk**: There is no synchronization between `PhysicsEngine.tick` (in main loop) and `NodePopup.update`.
    *   Scenario A: Physics Tick -> Render -> Popup Update (Good).
    *   Scenario B: Popup Update -> Physics Tick -> Render (Bad: Popup shows *previous* frame's position).
*   **Mitigation**: The `force` layout caused by `getBoundingClientRect` (L442 of `GraphPhysicsPlayground`) might inadvertently sync them by forcing the browser to resolve the frame, but it's an expensive way to sync.

## 4. Edge Case Inventory

*   **Zooming with Keyboard (Ctrl+/-)**:
    *   **Effect**: `dpr` changes immediately. `rect` (CSS px) might stay same or change slightly due to rounding.
    *   **Handling**: Detected next frame. Canvas resized. Resolution increases/decreases.
    *   **Visuals**: Sharpness snap. No position desync (due to `setTransform` handling).
*   **Moving Window to Projector (DPR 2 -> 1)**:
    *   **Effect**: Same as above. `dpr` drops. Canvas downscales.
    *   **Handling**: Robust.
*   **Resize Window while Dragging**:
    *   **Effect**: `rect` changes continuously.
    *   **Handling**: Fix 55 ensures `moveDrag` uses the new `rect`. The node stays under cursor.
*   **Passive Wheel Listeners**:
    *   **Observation**: `GraphPhysicsPlayground.tsx` (L308) adds keydown listeners. `useGraphRendering.ts` (L765) manually handles `wheel` and calls `e.preventDefault()`.
    *   **Verdict**: This prevents the "Ctrl+Scroll" browser zoom behavior *inside* the canvas, effectively hijacking it for internal zoom. This is good for app stability.

## 5. Pixel Snapping Forensic
`CameraTransform.ts`:
```typescript
if (this.pixelSnapping) {
    panX = Math.round(panX * zoom) / zoom;
}
```
*   **Forensic Finding**: This snaps to **CSS Pixels** (Logical).
*   **Impact**: On a 2x Retina screen, valid positions are 0.5, 1.0, 1.5. This logic forces 1.0, 2.0. We are discarding 50% of the spatial resolution.
*   **Improvement**: Should probably snap to `1 / (zoom * dpr)`.

## 6. Recommendations (For Future Implementation)

1.  **Unified rAF Loop**: Pass the `trackNode` geometry *out* of `useGraphRendering` (via a ref or callback) instead of having `NodePopup` poll for it. This eliminates the second `rAF` loop and the Double Reflow.
2.  **DPR-Aware Snapping**: Update `CameraTransform` to accept `dpr` and snap to `Math.round(val * zoom * dpr) / (zoom * dpr)`.
3.  **ResizeObserver**: Switch to `ResizeObserver` for `rect` updates to avoid `getBoundingClientRect` polling every frame, though this requires careful handling of the async nature.

## 7. Sign-off
The current implementation is **functionally correct** and **highly robust against desync**, at the cost of **CPU/GPU overhead** (polling and reflows). It prioritizes "never breaking" over "lowest possible energy usage".
