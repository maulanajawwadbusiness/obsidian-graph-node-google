# XPBD Mini Run 7: Coordinate System Scandissect & Fixes

## 1. Coordinate System Audit

We analyzed the transformation pipeline from Input Event to Physics Engine.

### 1.1 Coordinate Spaces
*   **Pointer Space**: Browser event coordinates (`e.clientX`, `e.clientY`). Origin: Top-left of viewport.
*   **Client Space**: Canvas-relative coordinates (`sx = clientX - rect.left`). Origin: Top-left of canvas element. Values are in "CSS Pixels".
*   **World Space**: Physics engine coordinates. Origin: Infinite plane center (0,0). Scale: 1 Unit = 1 CSS Pixel (at Zoom=1.0).
*   **Screen Space**: Projected world coordinates. Same as Client Space conceptually, but derived from World.

### 1.2 Transformation Pipeline
1.  **Input**: `GraphPhysicsPlayground` captures `e.clientX/Y`. Passing to `handleDragStart` or `handlePointerMove`.
2.  **Normalization**: `useGraphRendering` stores pending pointer state.
3.  **To World**: `clientToWorld` (via `CameraTransform`) converts Client -> World.
    *   `cx = clientX - rect.left`
    *   `world = (cx - width/2) / zoom + pan + center`
    *   **Verified**: Inverse matches `worldToScreen` perfectly.
    *   **Logic**: Uses `rect` (live) and `cameraRef` (current). Logic appears robust against Zoom/Pan.

### 1.3 Drag Propagation
1.  **Grab**: `grabNode` sets `dragTarget` to Node Position (World).
2.  **Sync**: `applyDragTargetSync` (in Render Loop) calls `clientToWorld` using *Current Camera*.
3.  **Move**: `moveDrag` updates `dragTarget` to current cursor world position.
4.  **Physics**: `applyKinematicDrag` (in XPBD Tick) snaps `node.x` to `dragTarget.x`.

### 1.4 The "Reversed Tug" Anomaly
User reported "reversed local tug" after zoom.
*   **Interpretation**: When zooming, the drag vector or the neighbor constraint response seems inverted.
*   **Finding**: Code analysis shows correct vector math. `dx` increases when dragging right, regardless of zoom.
*   **Hypothesis**: The issue is likely *Visual* or *Perceptual* due to the "Instant Snap" change in Part 0.
    *   Previously: Gradual Lerp (Mushy). Use didn't notice exact position.
    *   Now: Instant Snap. If there is *any* lag between Renderer Camera and Physics Input Camera, the node vibrates.
    *   However, `applyDragTargetSync` uses the *exact same camera* instance as the Renderer. So sync should be perfect.

## 2. Identified Code Issues

### 2.1 Unused Variable `dx` in Telemetry
In `engineTickXPBD.ts` (Release Ghost Telemetry):
```typescript
const dx = relNode.x - (preSolveSnapshot[nodeList.indexOf(relNode) * 2] || relNode.prevX);
```
*   **Issue**: This variable is shadowed/unused because `rx` is calculated immediately after in a specific block.
*   **Fix**: Remove the redundant calculation or use it. Given the stricter logic below it, we should remove the redundant `dx` declaration.

### 2.2 PreSolve Snapshot Safety
The code relies on `preSolveSnapshot`. We must ensure this snapshot is populated correctly at the start of the tick, otherwise `0` is used, leading to massive `dx` spikes (phantom ghosts).

## 3. Implementation Plan

1.  **Fix Lint**: Remove unused `dx` in `engineTickXPBD.ts`.
2.  **Verify Telemetry**: Ensure `releaseGhostEvents` logic is sound and doesn't cause false positives.
3.  **Confirm**: Since no fundamental coordinate bug was found in the `CameraTransform` logic, we proceed with the assumption that the "fix" involves ensuring the pipeline remains clean.
