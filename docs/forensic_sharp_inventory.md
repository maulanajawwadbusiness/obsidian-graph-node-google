# Forensic Report: Spring-Like Inventory (Knife-Grade)
**Date:** 2026-02-01
**Status:** SHARPENED

## 1. Force-Based Systems (Accumulators)
These systems write to `node.fx / node.fy`. They do NOT move nodes directly. XPBD integration must disable those that fight geometric constraints, but can keep those offering soft guidance.

| System | File Location | Write Target | Gate / Knob | XPBD Action |
| :--- | :--- | :--- | :--- | :--- |
| **Explicit Springs** | `src/physics/forces.ts:358` `applySprings` | `node.fx +=` | `springStiffness`, `link.strength` | **DISABLE**. Direct conflict with XPBD `DistanceConstraint`. Mixing causes double-stiffness and instability. |
| **Repulsion** | `src/physics/forces.ts:8` `applyRepulsion` | `node.fx +=` | `repulsionStrength`, `minNodeDistance` | **KEEP (Soft)**. XPBD collision is N^2 expensive. Use force-based repulsion for long-range, XPBD for hard contact (if needed). |
| **Collision (Force)** | `src/physics/forces.ts:277` `applyCollision` | `node.fx +=` | `collisionPadding` | **OPTIONAL**. If XPBD handles `ContactConstraint`, disable this. If XPBD is graph-only, keep this for node-node overlap prevention. |
| **Center Gravity** | `src/physics/forces.ts:715` `applyCenterGravity` | `node.fx +=` | `gravityCenterStrength` | **KEEP**. Global container. Does not fight local geometry. |
| **Boundary Push** | `src/physics/forces.ts:771` `applyBoundaryForce` | `node.fx +=` | `boundaryMargin` | **KEEP**. World bounds. |
| **Drag Force** | `src/physics/engine/engineTick.ts` (inline call to `applyForcePass` logic inside `forces.ts` or `forcePass.ts`) | `node.fx +=` | `draggedNodeId` | **DISABLE** (or ignored). XPBD handles drag via `invMass = 0`. Force-based drag fights the hard constraint of the mouse cursor. |

## 2. PBD-Like Constraints (Position Correctors)
These systems write to `correctionAccum.dx / dy`. They are proto-PBD systems. They MUST be disabled or ported to the main XPBD solver to avoid "Dual Solver" fighting.

| System | File Location | Write Target | Phase | XPBD Action |
| :--- | :--- | :--- | :--- | :--- |
| **Spacing Constraints** | `src/physics/engine/constraints.ts:184` `applySpacingConstraints` | `correctionAccum` | Post-Integ | **DISABLE**. This IS a positional contact constraint. XPBD `ContactConstraint` replaces it. |
| **Edge Relaxation** | `src/physics/engine/constraints.ts:28` `applyEdgeRelaxation` | `correctionAccum` | Post-Integ | **DISABLE**. Crude distance constraint. XPBD `DistanceConstraint` replaces it. |
| **Safety Clamp** | `src/physics/engine/constraints.ts:615` `applySafetyClamp` | `correctionAccum` | Post-Integ | **DISABLE**. Hard limiter. XPBD solver handles this naturally. |
| **Triangle Area** | `src/physics/engine/constraints.ts:451` `applyTriangleAreaConstraints` | `correctionAccum` | Post-Integ | **DISABLE/PORT**. If used, must move to XPBD `AreaConstraint` or `VolumeConstraint`. Leaving it here fights the solver. |

## 3. Velocity Mods (The "Motors")
These write to `node.vx / vy`. They act as temperature/annealing.

| System | File Location | Write Target | XPBD Action |
| :--- | :--- | :--- | :--- |
| **Drag Velocity** | `src/physics/engine/velocity/dragVelocity.ts` | `node.tx/ty, vx/vy` | **KEEP (Carefully)**. Sets velocity for momentum. But for position, XPBD MUST pin the node. |
| **Pre-Roll** | `src/physics/engine/velocity/preRollVelocity.ts` | `node.vx/vy` | **KEEP**. Initialization only. |
| **Dense Core Unlock** | `src/physics/engine/velocity/denseCoreVelocityUnlock.ts` | `node.vx/vy` | **KEEP**. Annealing signal. XPBD is stable enough to handle velocity noise. |
| **Phase Diffusion** | `src/physics/engine/velocity/localPhaseDiffusion.ts` | `node.vx/vy` | **KEEP**. Prevents crystallization. |

## 4. Render-Loop Overwrites (The "Vibe Killers")
| System | File Location | Write Target | XPBD Action |
| :--- | :--- | :--- | :--- |
| **Drag Sync** | `src/playground/rendering/graphRenderingLoop.ts:179` `applyDragTargetSync` | `node.x/y` | **ALERT**. Writes directly to node position before draw. **Must align with XPBD**. XPBD should see this node as `invMass=0` at `(mouseX, mouseY)`. If RenderLoop writes x/y *after* XPBD solve, it breaks constraint fulfillment for connected links (visual jitter). **FIX**: Sync input to physics *before* solve, never overwrite after solve. |

## 5. XPBD Insertion Point
- **File**: `src/physics/engine/engineTick.ts`
- **Line**: ~820 (Before final `forensicSnapshot` and `finalizePhysicsTick`).
- **Condition**: `if (engine.config.useXPBD)` (or similar).
- **Behavior**:
    1.  Apply Forces -> Velocity.
    2.  Integrate (Predict).
    3.  **XPBD Solve Loop** (Replaces `applyCorrectionsWithDiffusion` and `correctionAccum` logic).
    4.  Velocity Update (`v = (x - prevX) / dt`).
    5.  Finalize.
