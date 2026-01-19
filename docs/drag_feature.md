# Drag Feature Audit & Disablement

> Status: drag is **disabled by default** via `DRAG_ENABLED` to prevent broken behavior while preserving hover energy/glow and camera controls.

## 1) Current Drag Architecture (as implemented)

### Event flow (current)

1. **Mouse down → select node**
   - `GraphPhysicsPlayground.tsx` listens to `onMouseDown` on the main container and converts `clientX/clientY` to world coordinates via `clientToWorld()`.【F:src/playground/GraphPhysicsPlayground.tsx†L87-L153】
   - It performs a **naive world-space hit test** by scanning all nodes and checking `distance < node.radius + 10` (no ring width or theme scale accounted for).【F:src/playground/GraphPhysicsPlayground.tsx†L126-L143】
   - On hit, it calls `engine.grabNode(id, worldPos)`, which stores `draggedNodeId` and `dragTarget` on the physics engine.【F:src/playground/GraphPhysicsPlayground.tsx†L145-L148】【F:src/physics/engine.ts†L112-L151】

2. **Mouse move → update drag target**
   - `onMouseMove` runs every move and calls `engine.moveDrag(worldPos)`, updating `dragTarget`.【F:src/playground/GraphPhysicsPlayground.tsx†L150-L158】【F:src/physics/engine.ts†L155-L166】

3. **Mouse up / leave → release**
   - `onMouseUp` and `onMouseLeave` call `engine.releaseNode()` to clear drag state.【F:src/playground/GraphPhysicsPlayground.tsx†L160-L190】【F:src/physics/engine.ts†L168-L174】

### Physics integration (current)

- **Force-based pull toward target** happens inside the `ForcePass` during the physics tick. The force is *not scaled by energy* and is always applied when `draggedNodeId` is set.【F:src/physics/engine/forcePass.ts†L164-L183】
- **Velocity injection** occurs in `applyDragVelocity`, which pushes velocity toward `dragTarget` unless the node is fixed. The code never marks a dragged node as `isFixed`, so this path always runs for normal nodes.【F:src/physics/engine/velocity/dragVelocity.ts†L6-L28】【F:src/physics/engine.ts†L112-L151】

### Key state variables

- `PhysicsEngine.draggedNodeId` + `PhysicsEngine.dragTarget`: drag state source of truth for physics passes.【F:src/physics/engine.ts†L36-L43】
- `clientToWorld()` returned from `useGraphRendering` (via `hoverController.ts`) is the only coordinate conversion used by drag.【F:src/playground/GraphPhysicsPlayground.tsx†L32-L36】【F:src/playground/rendering/hoverController.ts†L189-L223】

## 2) Coordinate Spaces (current behavior)

There are three relevant spaces in the codebase:

1. **Screen space**: raw pointer coordinates in browser pixels (`clientX/clientY`).
2. **Canvas space**: pointer position relative to the canvas rectangle, using `getBoundingClientRect()` and centering the canvas (`rect.width / 2`, `rect.height / 2`).【F:src/playground/rendering/hoverController.ts†L189-L207】
3. **World space**: graph simulation coordinates; computed by un-applying camera pan/zoom and global rotation around the node centroid.【F:src/playground/rendering/hoverController.ts†L202-L210】

The drag pipeline uses `clientToWorld()` from the hover controller, which converts screen → canvas → world with camera pan/zoom and rotation. That is the **only** conversion method used for drag today.【F:src/playground/GraphPhysicsPlayground.tsx†L106-L120】【F:src/playground/rendering/hoverController.ts†L189-L223】

## 3) What’s Broken / Fragile (no fixes applied)

Below is a concrete diagnosis of drag-related issues based on the current code.

### A) Event handling + pointer lifecycle

1. **No pointer capture → drag dropouts**
   - Drag uses `onMouseDown/onMouseMove/onMouseUp` on the container, but never uses `setPointerCapture()` or pointer events. There is no `pointerdown/pointerup/pointercancel` lifecycle for drag. This makes drag fragile when the cursor exits the container or the browser loses focus, and it can prematurely end or miss move updates.【F:src/playground/GraphPhysicsPlayground.tsx†L87-L190】

2. **Mouse events only (no pointer types)**
   - Drag ignores `pointerType`, touch input, and active pointer tracking. Hover uses pointer events separately, so drag and hover have different event stacks, creating mismatched behavior and potential state divergence.【F:src/playground/GraphPhysicsPlayground.tsx†L38-L80】

### B) Hit testing / node selection

3. **Hit test radius mismatch (visual vs. drag)**
   - Drag hit test uses `node.radius + 10` in world units. Rendered node size depends on theme scale, ring width, and hover energy. The hit radius does **not** include ring width or theme scaling, so the drag target often doesn’t match the visual node size, especially in elegant mode.【F:src/playground/GraphPhysicsPlayground.tsx†L126-L143】【F:src/visual/theme.ts†L264-L329】

4. **No shared hover selection logic**
   - Hover selection uses a dedicated controller with calibrated hit/halo radii and calm mode; drag uses a separate naive scan. This causes inconsistent “what’s under the cursor” behavior between hover and drag, which is easy to perceive as “wrong selection.”【F:src/playground/GraphPhysicsPlayground.tsx†L126-L143】【F:src/playground/rendering/hoverController.ts†L150-L187】

### C) Coordinate / anchor handling

5. **No drag anchor offset → node snaps to cursor center**
   - Drag uses the cursor world position as the node’s target without retaining the initial grab offset. If the cursor grabs the node edge, the node snaps to center under the pointer on the first move, which feels like a position mismatch and can read as “wrong mapping.”【F:src/playground/GraphPhysicsPlayground.tsx†L112-L158】

6. **Camera motion during drag can de-sync**
   - The camera auto-contains and updates over time in rendering. The drag pipeline does not lock camera or compensate for camera changes while dragging, so if the camera pans/zooms mid-drag, the target can drift relative to the cursor, causing the “wrong cursor/world position” symptom.【F:src/playground/useGraphRendering.ts†L156-L188】【F:src/playground/rendering/camera.ts†L1-L75】

### D) Physics interaction

7. **Drag forces fight physics (no pinning)**
   - The engine never sets `node.isFixed = true` during drag. Instead it applies both a hard force and a velocity injection every tick. This can cause overshoot, wobble, or snapping back as the rest of the physics stack continues to act on the node (springs, constraints, damping).【F:src/physics/engine.ts†L112-L174】【F:src/physics/engine/forcePass.ts†L164-L183】【F:src/physics/engine/velocity/dragVelocity.ts†L6-L28】

8. **Drag affects only one node; neighbors still fully simulated**
   - The system doesn’t use “soft pinning” or temporary constraints. It only nudges the dragged node. Links and constraints can fight the drag, yielding unexpected recoil or drift, especially in dense graphs.【F:src/physics/engine/forcePass.ts†L164-L183】【F:src/physics/engine.ts†L112-L174】

### E) Ending drag / cleanup

9. **Release only on mouseup/leave**
   - `releaseNode()` is called on mouse up and mouse leave, but there is no pointer cancel or capture release handling. This makes the release path incomplete and can lead to half-drag states if the browser loses focus or the pointer is released outside the element without firing the expected events.【F:src/playground/GraphPhysicsPlayground.tsx†L160-L190】

## 4) Current Disable Knob (default OFF)

Drag is **disabled by default** using the `DRAG_ENABLED` toggle in `theme.ts`. When `false`, the drag entry point is gated and any existing drag state is force-cleared on mount or toggle change to avoid stuck drags or partial state.

- Toggle location: `src/visual/theme.ts` → `export const DRAG_ENABLED = false;`.【F:src/visual/theme.ts†L119-L123】
- Gating and cleanup: `GraphPhysicsPlayground.tsx` now checks the knob in `handleMouseDown`/`handleMouseMove` and releases any existing drag state when disabled.【F:src/playground/GraphPhysicsPlayground.tsx†L87-L175】

## 5) How to Fix Later (recommended plan)

### A) Unify event handling

- Use **pointer events** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) for drag.
- Call `setPointerCapture(pointerId)` on drag start and `releasePointerCapture(pointerId)` on drag end.
- Track a single active pointer ID to avoid multi-pointer conflicts.

### B) Single source of coordinate truth

- Use **one authoritative conversion** for pointer → world coordinates:
  - `clientX/clientY → canvas rect → screen centered → camera inverse → world`.
  - Reuse existing functions:
    - `clientToWorld()` for pointer → world conversion.
    - `worldToScreen()` for debug overlays or cursor alignment checks.【F:src/playground/rendering/hoverController.ts†L189-L223】

### C) Drag math under zoom / rotation

- Drag delta in world units should be `screenDelta / zoom` (rotation aware).
- Store a **drag anchor offset** when the drag starts:
  - `dragOffset = nodePosWorld - cursorWorld`.
  - During move: `dragTarget = cursorWorld + dragOffset`.

### D) Physics interaction

- On drag start:
  - Set `node.isFixed = true` or pin the node using explicit `fx/fy` or `pin` state.
  - Optionally reheat or wake the simulation (`engine.wakeNode` + `engine.wakeNeighbors`).
- On drag end:
  - Clear pin, optionally apply a final velocity based on recent cursor delta (in world units).
  - Reheat sim if needed to avoid immediate snap-back.

### E) Consistent hit testing

- Use the **same hit/halo radius logic as hover** (rendered outer radius + padding).
- Provide a **drag start threshold** (e.g., 4–6 px) to prevent accidental drags on click.

## 6) Tuning Knobs To Add Later

- Drag hit radius padding
- Drag start threshold (px)
- Drag friction/damping (drag lag)
- Drag inertia on release
- Spring reheat strength
- Cursor styles (`grab`/`grabbing`)
- Optional node lock mode (fixed vs. soft pin)

## 7) Debug Hooks (recommended)

- **Draw cursor world point** (crosshair): compare cursor world position to node target.
- **Draw drag anchor offset** (line from cursor to node target).
- **Log camera state** during drag (pan, zoom, rotation).
- **Overlay current drag target** position in world and screen space.

## 8) Acceptance Checklist (current state)

- ✅ Drag disabled by default (`DRAG_ENABLED = false`).【F:src/visual/theme.ts†L119-L123】
- ✅ Hover energy + glow remain untouched (no code changes in hover/rendering paths).
- ✅ No node movement on click/hover because drag entry points are gated.【F:src/playground/GraphPhysicsPlayground.tsx†L87-L175】
- ✅ No pointer capture usage (so no stuck capture or jitter introduced by this change).
- ✅ Documentation exists and describes architecture + fix plan (this file).
