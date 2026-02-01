# Forensic Inventory: Spring-Like Behaviors (XPBD Prep)

**Date:** 2026-02-01
**Purpose:** inventory all systems acting as springs, tethers, or position constraints to identify conflicts with XPBD integration.

## 1. Inventory Table

| System | Type | Stage | Effect/Writes | Limit/Gate | Anchor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Explicit Springs** | Force (Spring) | ForcePass | `node.fx += k * dx` | `link.strength`, `springStiffness` | `forces.ts:applySprings` |
| **Repulsion** | Force (Push) | ForcePass | `node.fx += k/d` | `repulsionDistanceMax`, `densityBoost` | `forces.ts:applyRepulsion` |
| **Collision** | Force (Push) | ForcePass | `node.fx += overlap * k` | `collisionPadding` | `forces.ts:applyCollision` |
| **Center Gravity** | Force (Pull) | ForcePass | `node.fx += dist * k` | `gravityBaseRadius` (Elliptical) | `forces.ts:applyCenterGravity` |
| **Boundary Push** | Force (Push) | ForcePass | `node.fx += pen * k` | `worldWidth/Height` | `forces.ts:applyBoundaryForce` |
| **Drag Force** | Force (Spring) | ForcePass | `node.fx += dx * 200` | `engine.draggedNodeId` | `forcePass.ts` (Line 247) |
| **Drag Sync** | Teleport (Sync) | RenderLoop | `node.x = mouse.x` | `engine.draggedNodeId` | `graphRenderingLoop.ts:applyDragTargetSync` |
| **Edge Relax** | Position (Nudge) | Constraint | `corrAccum.dx += err * k` | `linkRestLength`, `alpha` | `constraints.ts:applyEdgeRelaxation` |
| **Spacing** | Position (Repel) | Constraint | `corrAccum.dx += pen * k` | `minNodeDistance`, `softDistance` | `constraints.ts:applySpacingConstraints` |
| **Triangle Area** | Position (Inflation) | Constraint | `corrAccum.dx += def * k` | `restArea` | `constraints.ts:applyTriangleAreaConstraints` |
| **Safety Clamp** | Position (Hard) | Constraint | `corrAccum.dx += pen` | `minNodeDistance` (Hard) | `constraints.ts:applySafetyClamp` |
| **Micro-Slip** | Velocity (Shear) | Velocity | `node.vx = perp + par*(1-r)` | `policy.diffusion`, `isDense` | `denseCoreVelocityUnlock.ts` |
| **Friction Bypass** | Velocity (Kick) | Velocity | `node.vx += perp * k` | `stuckScore`, `relVel` | `staticFrictionBypass.ts` |
| **Ang. Decohere** | Velocity (Rot) | Velocity | `node.vx` rotated | `policy.earlyExpansion` | `angularVelocityDecoherence.ts` |
| **Inertia Relax** | Velocity (Blend) | Velocity | `node.vx` blended w/ neigh | `stuckness`, `density` | `denseCoreInertiaRelaxation.ts` |
| **Phase Diff** | Velocity (Rot) | Velocity | `node.vx` rotated | `policy.earlyExpansion` | `localPhaseDiffusion.ts` |
| **Edge Shear** | Velocity (Shear) | Velocity | `node.vx` sheared | `linkRestLength` satisfied | `edgeShearStagnationEscape.ts` |
| **Drag Damping** | Velocity (Damp) | Velocity | `node.vx *= (1-k)` | Global | `velocityPass.ts` (imports) |

## 2. Conflict Map (XPBD Conflicts)

XPBD (Extended Position Based Dynamics) handles distance constraints (springs) and contact constraints (repulsion/collision) fundamentally differently (projection vs force).

### High Conflict (Must Disable/Replace)
1.  **Explicit Springs (`applySprings`)**: XPBD handles this via `DistanceConstraint`. Mixing force-based springs and PBD springs creates "fighting" and double-stiffness.
2.  **Edge Relaxation (`applyEdgeRelaxation`)**: This is a crude PBD-like position nudge. It conflicts directly with XPBD.
3.  **Spacing Constraints (`applySpacingConstraints`)**: This is a position-based repulsion. XPBD `ContactConstraint` replaces it.
4.  **Safety Clamp (`applySafetyClamp`)**: This is a hard position clamp. XPBD Contact constraints act as the hard clamp.
5.  **Triangle Area (`applyTriangleAreaConstraints`)**: Conflicts if XPBD implements area constraints, otherwise it's a "secondary" constraint that effectively modifies position. Since it writes to `correctionAccum`, it must be disabled or ported to XPBD `AreaConstraint`.

### Medium Conflict (Careful Management)
1.  **Drag Force**: XPBD usually handles drag by setting `invMass = 0` for the dragged node, making it "infinite mass" and directly setting its position. The Force-based drag (`forcePass.ts`) influences velocity (`vx`), which is fine for momentum transfer (throw), but `Drag Sync` (RenderLoop) overwrites position.
    *   *Plan*: Keep `Drag Force` for velocity momentum, but rely on XPBD `invMass=0` for position control.
2.  **Repulsion (Force)**: XPBD can handle repulsion (Contact), but Force-based repulsion is often smoother for long-range.
    *   *Plan*: Keep Force-based PUSH (`applyRepulsion`) for long-range separation. Use XPBD only for hard internal contacts if needed. PBD Collision is expensive to solve iteratively for N^2.

### Low Conflict (Keep)
1.  **Velocity Mods (Micro-Slip, etc)**: These modify `vx/vy` *before* integration (or *before* PBD solve if structured right). XPBD derives velocity from position (`(p - oldP)/dt`). If we modify `v` before `p = x + v*dt`, the "intended" position `p` reflects these mods. PBD then corrects `p` to `p'`. The final velocity `v = (p' - oldP)/dt` will implicitly include the PBD reaction to the velocity mod.
    *   *Conclusion*: **SAFE**. These act as "motors" or "temperature" driving the system.

## 3. XPBD Mode Plan

To enable XPBD mode, we must cleanly gate off the conflicting systems using a new `xpbdEnabled` flag (or `useXPBD` config).

### DISABLE List (When `xpbdEnabled = true`)
-   [ ] `applySprings` (ForcePass) -> Replaced by `XPBDDistanceConstraint`.
-   [ ] `applyEdgeRelaxation` (Constraints) -> Redundant.
-   [ ] `applySpacingConstraints` (Constraints) -> Replaced by `XPBDContactConstraint`.
-   [ ] `applySafetyClamp` (Constraints) -> Redundant.
-   [ ] `applyTriangleAreaConstraints` (Constraints) -> Disable or Port.

### KEEP List
-   [x] `applyRepulsion` (ForcePass) -> Keep for soft long-range separation.
-   [x] `applyCenterGravity` (ForcePass) -> Keep for world containment.
-   [x] `applyBoundaryForce` (ForcePass) -> Keep for world bounds.
-   [x] `applyDragVelocity` (VelocityPass) -> Keep for damping.
-   [x] `applyDenseCore...` (VelocityPass) -> Keep as "Solver Coma" prevention motors.

### MODIFIED List
-   [ ] `applyDragTargetSync` -> XPBD needs to know about dragged nodes to set `w=0`. The sync might still be needed for visual smoothness, but `engineTick` needs to know *before* solve.
    *   *Plan*: Move drag update earlier? Or rely on `interactionLock`?
    *   Actually: `engine.grabNode` sets `draggedNodeId`. XPBD solve should check this ID and set `w=0` for that node effectively pinning it during the solve step. Standard `integrate` should still run.
