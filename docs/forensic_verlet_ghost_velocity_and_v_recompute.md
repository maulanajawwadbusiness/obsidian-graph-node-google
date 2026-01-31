# Forensic Report: Verlet Ghost Velocity & History Consistency

## 1. State Representation Audit
The system primarily uses **Symplectic Euler** integration, not Verlet.
-   **State**: `x, y` (Position), `vx, vy` (Velocity).
-   **History**: `prevX, prevY` does **NOT** exist in `PhysicsNode` (currently).
-   **Integration**: `x += vx * dt` (in `integration.ts`).

## 2. Velocity Consistency Analysis
### Where is Velocity Derived?
1.  **Implicit**: `vx` is not derived from `x - prevX`. It is stored explicitly.
2.  **Explicit Injection (The "Ghost" Source)**:
    -   File: `src/physics/engine/corrections.ts`
    -   Function: `reconcile(nx, ny)`
    -   Code: `node.vx += vxImplicit * ...` where `vxImplicit = nx / dt`.
    -   **Behavior**: When PBD moves a node (`x += dx`), it *also* adds `dx/dt` to velocity.
    -   **Result**: This transforms a positional fix (anti-overlap) into kinetic energy (rebound). This is "Strategy B" (Rederive) logic applied to an Euler system, creating a feedback loop ("Ghost Velocity").

### Inconsistent Stages
-   **Constraints**: Calculate `dx`.
-   **Corrections**: Apply `x += dx` AND `v += dx/dt`.
-   **Correction Tax**: We *remove* velocity fighting the correction (`v -= proj`), but then `reconcile` *adds* velocity along the correction. Mixed signal.

## 3. Recommended Fix (Strategy A - History Follow)
Since we are Euler-based:
-   **Principle**: Positional corrections are "teleports" to satisfied states. They should **NOT** affect momentum (`v`).
-   **Action**: Remove the `node.vx += ...` logic in `reconcile`.
-   **Result**: Constraint resolution will be "overdamped" (energy loss), which leads to stable stacking (the desired behavior).

## 4. Resolution & Fixes Applied
-   **History State**: Added `prevX, prevY` to `PhysicsNode` for diagnostics.
-   **Strategy A Enforced**: Disabled `reconcile()` velocity injection in `corrections.ts`. PBD corrections are now purely positional (Overdamped).
-   **Metrics**: Added `maxPrevGap` and `ghostVelSuspectCount` to HUD.

## 5. Verification Protocol
1.  **Ghost Velocity Test**:
    -   Open HUD.
    -   Observe `Ghost Velocity Audit`.
    -   `Suspects` should be 0 (or very low transiently).
    -   Drift should be minimal at rest.
2.  **Energy Stability**:
    -   Nodes should settle to `microkill` or `sleep` state.
    -   No infinite "moving" state due to constraint rebound.
