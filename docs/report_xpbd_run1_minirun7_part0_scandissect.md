# XPBD Mini Run 7: Drag Coupling - Part 0 Scandissect

## Current Drag Pipeline Documentation

### Drag State Storage

**Primary Location**: `PhysicsEngineTickContext` (engineTickTypes.ts:10-11)
```typescript
draggedNodeId: string | null;  // Which node is being dragged
dragTarget: { x: number; y: number } | null;  // Pointer world position
```

**Also tracked**:
- `lastDraggedNodeId` - For focus/camera tracking after release
- `grabOffset` - Repurposed to store initial grab position (for max distance clamp)

### Drag State Management

**Start Drag**: `engineInteraction.ts:grabNode()`
- Line 88: `engine.draggedNodeId = nodeId`
- Line 96: `engine.dragTarget = { x: node.x, y: node.y }` (initialized to node position, NOT cursor)

**Update Drag**: `engineInteraction.ts:dragNode()`
- Line 118: `engine.dragTarget = { ...position }` (updates to cursor position)
- Line 120: `wakeNode(engine, engine.draggedNodeId)`
- Line 124: `wakeNeighbors(engine, engine.draggedNodeId)` (if needed)

**Release Drag**: `engineInteraction.ts:releaseNode()`
- Line 133: `engine.lastReleasedNodeId = engine.draggedNodeId`
- Line 154: `engine.draggedNodeId = null`
- Line 155: `engine.dragTarget = null`

### Current XPBD Tick Order

**File**: `engineTickXPBD.ts:runPhysicsTickXPBD()`

1. **Preflight** (line 439)
   - `runTickPreflight(engine, nodeList)`
   - Inventory maintenance, constraint rebuild if dirty

2. **Integration** (line 515)
   - Apply drag velocity (if not disabled) - line 512
   - `integrateNodes()` - Euler/Verlet integration
   - Result: positions updated to x* (predicted)

3. **Kinematic Drag Lock** (line 530) ← **CURRENT DRAG HANDLER**
   - `applyKinematicDrag(engine, dt)`
   - Snaps dragged node to target BEFORE solver
   - Sets kinematic velocity, reconciles prevX/prevY
   - Sets `isFixed = true` (pins for solver)

4. **Solver** (line 551)
   - Snapshot positions before solve
   - `solveXPBDEdgeConstraints(engine, dt)`
   - Constraints correct positions based on rest lengths
   - **Dragged node has invMass=0** (line 337-338)

5. **Reconcile** (line 565)
   - `reconcileAfterXPBDConstraints()`
   - Syncs prevX/prevY to prevent ghost velocity
   - Updates ALL nodes (including dragged)

6. **Finalize** (line 647)
   - `finalizePhysicsTick()`
   - Sleep detection, HUD update

### How Drag Currently Influences Physics

#### During Drag (draggedNodeId != null)

**Position**:
- Line 12-90: `applyKinematicDrag()` moves node toward `dragTarget`
- Uses gradual lerp (MAX_MOVE_PER_FRAME = 50px) to prevent topology shock
- Clamps to MAX_DRAG_DISTANCE = 300px from initial grab position

**Mass**:
- Line 337-338 in solver: `invMass = 0` if `node.id === engine.draggedNodeId`
- This makes dragged node PINNED for constraint solving
- Neighbors stretch toward it, but it doesn't move in solver phase

**Velocity**:
- Line 75-76: Computes kinematic velocity from position delta
- `vx = (x - oldX) / dt`
- This represents drag motion, NOT physics motion

**History**:
- Line 84-85: `prevX = oldX, prevY = oldY`
- This makes (x - prevX) reflect the drag step
- Maintains velocity continuity across frames

#### After Release (draggedNodeId == null)

**Immediate**:
- `releaseNode()` sets draggedNodeId & dragTarget to null
- Node's `isFixed` is restored to false (line 136-144 in engineInteraction)

**Subsequent Frames**:
- Node treated as normal free body
- invMass = 1, participates normally in solver
- Existing velocity (from last drag frame) continues
- Springs pull it back toward equilibrium

### Issues with Current Implementation

1. **Line 88: `isFixed = true` set during drag**
   - This is REDUNDANT with invMass=0 check in solver
   - Could conflict if node was originally fixed
   - Need cleaner separation

2. **Gradual lerp (MAX_MOVE_PER_FRAME)**
   - Adds latency/lag to drag response
   - User reports "mush" - likely from this
   - Should be instant for crisp feel

3. **MAX_DRAG_DISTANCE clamp**
   - Good for stability, but might feel restrictive
   - 300px might be too small for large graphs

4. **Release transition**
   - No special handling for prevX/prevY on release
   - Could inject unwanted velocity if prevX not set correctly

### Summary of Accessed Fields

| Component | Fields Read | Fields Written |
|-----------|-------------|----------------|
| `applyKinematicDrag` | draggedNodeId, dragTarget, grabOffset | node.x, node.y, node.vx, node.vy, node.prevX, node.prevY, node.isFixed, grabOffset |
| `solveXPBDEdgeConstraints` | draggedNodeId (for invMass check) | node.x, node.y, constraint.lambda |
| `reconcileAfterXPBDConstraints` | (none - processes all nodes) | node.prevX, node.prevY |

---

## Next Steps

Based on this scandissect:

1. **Remove gradual lerp** - Instant snap for crisp response
2. **Clean up isFixed** - Don't mutate node.isFixed, use invMass=0 only
3. **Improve release** - Explicit prevX/prevY reconciliation
4. **Add telemetry** - xpbdPinnedCount, xpbdDraggedNodePinned
5. **Document invariants** - Clear rules for when invMass=0, when prevX=x

