# XPBD Mini Run 7: Drag Coupling (Kinematic Pinning)

## Implementation Details

### 1. Kinematic Pinning
**Method**: Option A (invMass = 0)
**Files**: `src/physics/engine/engineTickXPBD.ts`

Logic:
```typescript
const isDraggedA = nA.id === engine.draggedNodeId;
const wA = (nA.isFixed || isDraggedA) ? 0 : 1.0;
```
When `wA` is 0, the solver treats the node as having infinite mass, meaning constraint corrections will **fully propagate** to the neighbor (`nB`) without moving `nA`.

### 2. Position Injection
We force the dragged node to the mouse position **before** the solver phase (lines 350+ in `engineTickXPBD.ts`).
```typescript
draggedNode.x = engine.dragTarget.x;
draggedNode.y = engine.dragTarget.y;
```
This ensures the solver constraints have a "Moving Anchor" to solve against.

### 3. Ghost Velocity Prevention
Requirement: "Set prevX to same as x each frame during drag"
Why: To ensure that `v = (x - prevX)/dt` is zero (or controlled). If we let `prevX` lag behind, `reconcileAfterXPBDConstraints` might try to apply global corrections to it, or worse, releasing the node would result in a massive velocity vector `(mouse - old_position)` calculated by the integrator in the next frame.

Code:
```typescript
if (draggedNode.prevX !== undefined) draggedNode.prevX = draggedNode.x;
if (draggedNode.prevY !== undefined) draggedNode.prevY = draggedNode.y;
```

### 4. Telemetry
New HUD fields in XPBD Springs section:
- `drag`: ON/OFF
- `k`: 1 if kinematic pinning applied
- `sync`: Number of history sync events (should match frame rate during drag)

## Verification

### Gesture 1: The Tug
- **Action**: Grab a node connected to a cluster. Drag meaningful distance.
- **Expected**: Neighbors should **instantly** stretch and follow. No lag.
- **HUD**: `drag: ON`, `k=1`. `corrMax` should spike as springs stretch.

### Gesture 2: The Release
- **Action**: Drag and hold, then release.
- **Expected**: Node should NOT fly off (Explosion/Ghost Kick). It should effectively drop in place and let constraints pull it back.
- **Physics**: Because `prevX` was synced to `x`, `velocity` is effectively zero on release.

### Gesture 3: The Whip
- **Action**: Grab and shake violently, then release while moving.
- **Expected**: This implementation zeros velocity (`prevX = x`), so the node will **stop** mid-air and then accelerate via spring forces. It will **NOT** carry the mouse throw velocity. This satisfies the "clean ringdown" requirement (safer than inheriting chaotic throw velocity).

## Files Modified
1. `src/physics/engine/engineInteraction.ts` (Reference only, no changes needed for this slice)
2. `src/physics/engine/engineTickXPBD.ts` (Core logic)
3. `src/physics/engine/engineTickTypes.ts` (Telemetry types)
4. `src/physics/engine/engineTickHud.ts` (Telemetry wiring)
5. `src/physics/engine/physicsHud.ts` (Telemetry types)
6. `src/playground/components/CanvasOverlays.tsx` (UI)

## Status
✅ Complete.
