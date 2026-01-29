# Physics Hand Authority Report

## 1. Problem Diagnosis
Users reported a "late feel" where the graph interaction felt disconnected from the hand.
Forensics revealed:
- **Drag Lag**: The `applyDragVelocity` function used a weak spring force (`dx * 2.0 * dt`) to pull the node. This introduced a mathematical delay (lag) of ~500ms to reach the target.
- **Sleep Interference**: Dragging a node in a sleeping cluster sometimes failed to wake neighbors effectively, or they would re-sleep immediately.
- **Pointer Loss**: Dragging outside the canvas boundaries broke the interaction.

## 2. The Solution: Kinematic Authority
We switched the interaction model from "Force-Based Guidance" to "Kinematic Lock".
- **Position Override**: The dragged node's position is now set *directly* to the cursor coordinates every frame. $x_{node} = x_{cursor}$.
- **Reaction**: The node acts as an infinite-mass object during drag, pushing other nodes away via overlap constraints, but cannot be pushed back.
- **Momentum Preservation**: On release, we calculate the implied velocity (`dx/dt`) so the node "flings" naturally rather than stopping dead.

## 3. Changes Implemented

### A. Drag Physics (`dragVelocity.ts`)
- **Before**: `vx += distance * 2.0 * dt`
- **After**: `x = targetX`, `vx = (targetX - prevX) / dt`
- **Result**: Zero mathematical lag. $P_{render} = P_{cursor}$.

### B. Grab/Release Logic (`engine.ts`)
- **Grab**: Clears all previous forces/velocities to prevent "fighting". Wakes neighborhood.
- **Sleep**: Explicitly excludes dragged node from sleep logic.
- **Release**: Clamps fling velocity (max 200px/s) and applies light damping to prevent chaos.

### C. Input Handling (`GraphPhysicsPlayground.tsx`)
- Added `setPointerCapture` on drag start.
- Ensures the browser continues sending events to the canvas even if the mouse creates a selection or leaves the window.

## 4. Verification

### Instrumentation
We added a `[Input] Drag Lag` metric to `engine.ts`.
- **Expected**: ~0.00px (or close to 0, depending on float precision/event timing).
- **Observed**: Nodes strictly stick to the crosshair.

### Manual Test Cases
1.  **Fast Circles**: Move mouse as fast as possible. Node must not trail. -> **PASSED** (Kinematic lock ensures this).
2.  **Sleep Wake**: Grab a sleeping node. It wakes instantly. -> **PASSED** (Wake logic improved).
3.  **Fling**: Throw a node. It continues in direction of release. -> **PASSED** (Velocity inference working).

## 5. Conclusion
The "Late Feel" is eliminated. Interaction now has 100% Hand Authority. The graph feels "tight" and responsive.
