# Run 2: Kinematic Drag for Spring–Mass ("Hand is God")

## Summary
This run makes dragging knife-sharp in spring–mass mode by treating the dragged dot as kinematic (position set directly from pointer world coords), while all other dots remain dynamic and respond through springs. Release zeroes velocity to avoid slingshot energy.

## Files Touched
- `src/physics/springMass/springMassBackend.ts`
- `src/physics/engine.ts`
- `src/physics/engine/physicsHud.ts`
- `src/playground/components/CanvasOverlays.tsx`
- `src/playground/rendering/graphDraw.ts`
- `docs/run2_drag_kinematic.md`

## Drag Pipeline (Exact)
1. Pointer events are captured by the canvas container (existing path) and converted to world-space coordinates via `clientToWorld`.
2. `engine.moveDrag({ x, y })` stores the world-space drag target in `engine.dragTarget`.
3. In spring–mass mode, `engine.tick` calls:
   - `springMassBackend.setDraggedDot(engine.draggedNodeId)`
   - `springMassBackend.setDragTarget(engine.dragTarget)`
4. `SpringMassBackend.stepFixed` applies the kinematic override:
   - If a dragged dot exists, its `x/y` are set from the drag target before force accumulation.
   - The dragged dot is excluded from force integration while still exerting spring forces on neighbors.

## Velocity Strategy (Chosen)
**A) Stable lock**
- While dragging: `vx = vy = 0` every step.
- On release: `vx = vy = 0` and forces cleared once.

**Why:** guarantees no slingshot launch and keeps the hand feel deterministic and sharp.

## HUD + Visual Marker
- HUD now shows `Drag: <dotId>` and `dragMode` plus pointer world coords.
- Dragged dot is rendered with a subtle gold outline ring to confirm kinematic status.

## Manual Test Checklist (Hand Feel)
- Enable spring–mass mode (debug panel).
- Drag a dot inside a cluster:
  - dot stays glued to cursor in world space with near-zero lag.
  - neighbors respond within 1–3 frames (springs tension visible).
- Release:
  - no slingshot launch.
  - motion decays and settles in under ~1s.
- Verify pointer capture reliability (drag doesn’t drop unexpectedly).
