# XPBD Run 1: Mini Run 7 - Drag Coupling

## Goal
Make dragging feel physical: immediate response (kinematic pin) and elastic release (momentum transfer).

## Implementation Details

### 1. Kinematic Lock (Engine Tick)
-   **File**: `src/physics/engine/engineTickXPBD.ts`
-   **Function**: `applyKinematicDrag(engine, dt)`
-   **Logic**:
    -   Locates `engine.draggedNodeId`.
    -   Forces `node.x` / `node.y` to match `engine.dragTarget`.
    -   **Critical**: Updates `node.prevX/prevY` to `oldX/oldY` (position *before* the snap).
    -   **Result**: `(node.x - node.prevX)` correctly represents the drag velocity for the frame. Solver uses this implicit velocity.

### 2. Solver InvMass
-   **File**: `src/physics/engine/engineTickXPBD.ts`
-   **Logic**: `solveXPBDEdgeConstraints` checks `nA.id === engine.draggedNodeId`.
-   If true, mass is treated as infinite (`w=0`).
-   Correction is applied 100% to the neighbor node. No spring force moves the hand.

### 3. Release Momentum (Engine Interaction)
-   **File**: `src/physics/engine/engineInteraction.ts`
-   **Logic**: `releaseNode` previously zeroed `vx/vy`.
-   **Change**: Removed `vx=0` lines.
-   **Result**: The node retains the velocity calculated in `applyKinematicDrag` (via implicit step `x-prevX`) or from the last tick's integration.
-   Because `applyKinematicDrag` runs every tick, `vx` is kept fresh with the user's hand velocity. On release, it flies.

### 4. Telemetry
-   **HUD**: Added `drag: ON/OFF`, `draggedNodeId`, `mode: pinned(0)`.
-   **Ghost Velocity**: `xpbdGhostVelEvents` tracks if non-dragged nodes are teleporting. Dragged node teleporting is expected (it's the hand), but its history is reconciled so it shouldn't trigger ghost alerts on itself if logic is sound.

## Verification Plan (Manual)

### T1: Direct Connection (Feel)
-   **Action**: Drag a node connected to others. Move mouse quickly back and forth.
-   **Expectation**:
    -   Node follows mouse *instantly* (0 lag).
    -   Neighbors stretch elastically.
    -   HUD `drag: ON`. `mode: pinned(0)`.

### T2: Release Ringdown
-   **Action**: Drag node, build up speed, release while moving.
-   **Expectation**:
    -   Node continues in direction of throw (Momentum).
    -   Oscillates 1-3 times and settles.
    -   NO "dead stop" or "teleport spike".
    -   HUD `xpbdGhostVelEvents` remains low/zero during release.

### T3: Cross-Check
-   Test with N=5, N=20, N=60. Behavior should be consistent.
