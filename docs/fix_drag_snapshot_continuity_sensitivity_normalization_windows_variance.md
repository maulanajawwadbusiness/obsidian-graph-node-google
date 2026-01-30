# Fix: Drag Snapshot Continuity, Zoom Sensitivity, & OS Variance

## Context
The "Drag Feel" of the application suffered from three distinct issues that degraded the user experience:
1. **First-Frame Jump**: Dragging a node often caused it to "jump" slightly on the very first frame. This was caused by a mismatch between the camera state used for the initial grab (event time) and the camera state used for the first render (frame time).
2. **Inconsistent Zoom Sensitivity**: Pan and zoom operations felt "fast" or "slow" depending on the current zoom level, rather than feeling like a direct 1:1 manipulation of the surface.
3. **OS Pointer Variance**: Different operating systems and input devices (trackpads vs. mice) produced vastly different `deltaY` magnitudes, causing uncontrollable zooms on some devices (e.g., Windows Precision Drivers).

## Fixes Implemented

### 1. Snapshot Continuity (Deferred Drag Start)
**Problem**: `onPointerDown` calculated the world-space anchor immediately. If the camera moved (physics/inertia) between the event and the next render, that anchor became stale, causing a visible jump when the drag target was applied.
**Fix**: `GraphPhysicsPlayground.tsx` now calls `setPendingDrag` instead of `engine.grabNode`. The `graphRenderingLoop.ts` checks this pending state at the *start of the render frame*, calculating the anchor using the *exact* camera and surface state that will be used for drawing.
**File**: `src/playground/rendering/graphRenderingLoop.ts`
**Line**: `render()` start block.

### 2. Screen-Constant Sensitivity
**Problem**: Panning and dragging felt disconnected from the cursor at high or low zoom levels.
**Fix**: Enforced a "Screen-Constant" doctrine. The math now ensures that if the mouse moves $D$ pixels on screen, the world pans by $D/Zoom$ units. This guarantees the point under the cursor *stays* under the cursor, maintaining "direct manipulation" feel.
**File**: `src/playground/rendering/graphRenderingLoop.ts`
**Function**: `handleWheel` (Pan calculation).

### 3. OS Variance Guard
**Problem**: Windows trackpads and high-DPI mice could report `deltaY` values in the hundreds, whereas macOS trackpads report smaller values, leading to "rocket jumps" in zoom.
**Fix**: Implemented a hard clamp on `deltaY` (-150 to 150) to normalize extreme inputs.
**File**: `src/playground/rendering/graphRenderingLoop.ts`
**Function**: `handleWheel`.

### 4. Drag Target Sync
**Problem**: `applyDragTargetSync` used the `hoverController`'s internal camera reference, which might lag behind the render loop's interpolated camera state.
**Fix**: Explicitly passed the `camera` object from `render()` to `applyDragTargetSync()`, ensuring drag mathematics use the live frame data.
**File**: `src/playground/rendering/graphRenderingLoop.ts`

## Verification
- **Drag Start**: Verified that grabbing a moving node or grabbing during a pan/zoom no longer snaps the node to a stale position. The visual anchor remains perfectly glue-like.
- **Zoom**: Confirmed that zooming in/out keeps the mouse pointer fixed relative to the world features under it (stable fixed point).
- **Wheel**: Verified that rapid scrolling on high-sensitivity devices no longer causes disorientation.

## Outcome
The application interactions now feel "solid" and "heavy", with 1:1 direct manipulation fidelity regardless of zoom level or input device.
