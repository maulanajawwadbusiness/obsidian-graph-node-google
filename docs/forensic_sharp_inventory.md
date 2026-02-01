# Forensic Report: Spring-Like Inventory (Knife-Grade)
**Date:** 2026-02-01
**Status:** RAZOR SHARP
**Scope:** Complete inventory of every line of code that affects node motion (Force, Velocity, Position, Correction).

## 1. Timeline & Execution Order
The physics tick (`src/physics/engine/engineTick.ts`) executes systems in this strict order.
**XPBD Insertion Point:** Immediately after `integrateNodes` (replacing Constraints/Corrections) or interleaved if using hybrid.

| Order | Phase | System | Write Target | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Forces | `applyForcePass` | `fx, fy` | Accumulates forces. |
| 2 | V-Mod | `applyDragVelocity` | `vx, vy` | Damping/Targeting. |
| 3 | Integ | `integrateNodes` | `x, y, vx, vy` | **Primary Motion**. `x += v * dt`. |
| 4 | Micro | Expansion/MicroSlip/etc | `vx, vy` | Velocity annealing. |
| 5 | Constr | Spacing/Edge/Triangle | `correctionAccum` | PBD Accumulation (Vector). |
| 6 | V-Mod | Angle/DistanceBias | `vx, vy` | **Late Velocity Mods** (in Constraint block). |
| 7 | Constr | SafetyClamp | `correctionAccum` | Hard limits. |
| 8 | Correct | `applyCorrections...` | `x, y` | **Primary Constraint Apply**. |
| 9 | Final | `finalizePhysicsTick` | `N/A` | Cleanup/History. |

---

## 2. Force Writers (`node.fx += ...`)
Accumulate forces before integration. `F = ma`.

| System | File Location | Range | Gating / Thresholds | XPBD Action |
| :--- | :--- | :--- | :--- | :--- |
| **Repulsion** | `src/physics/forces.ts` | L8-275 | `repulsionStrength`, `activeNodes` | **KEEP (Soft)**. N^2 expensive but necessary for "Cluster" feel. Disable if XPBD handles all collision. |
| **Collision** | `src/physics/forces.ts` | L277-356 | `collisionStrength` | **DISABLE** if XPBD `ContactConstraint` is used. |
| **Springs** | `src/physics/forces.ts` | L358-634 | `springStiffness`, `links` | **DISABLE**. Direct conflict with XPBD `DistanceConstraint`. |
| **CenterGravity** | `src/physics/forces.ts` | L715-763 | `gravityCenterStrength` | **KEEP**. Global container. |
| **Boundary** | `src/physics/forces.ts` | L771-820 | `boundaryMargin` | **KEEP**. World bounds. |

---

## 3. Integration & Position Writers (`node.x/y = ...`)
Directly modify position. The "Integrator".

| System | File Location | Range | Write Details | XPBD Action |
| :--- | :--- | :--- | :--- | :--- |
| **Integration** | `src/physics/engine/integration.ts` | L14-245 | `x += vx * dt` | **MODIFY/KEEP**. XPBD specific integration is usually `x = x + v * dt` (Prediction). This function includes Damping, Clamping, and Inertia. |
| **Corrections** | `src/physics/engine/corrections.ts` | L6-532 | `x += selfDx` | **REPLACE**. This is the PBD solver application. XPBD loop replaces this entire file. |
| **Drag Sync** | `src/playground/rendering/graphRenderingLoop.ts` | L179-203 | `x = target.x` | **WARNING**. Runs in Render Loop. Overwrites physics if `draggedNodeId`. Ensure XPBD treats dragged node as infinite mass (inverseMass = 0) to match. |

---

## 4. Constraint Accumulators (`correctionAccum` writers)
These systems calculate a vector `(dx, dy)` and add it to `correctionAccum`. They do NOT move nodes directly.

| System | File Location | Range | Logic | XPBD Action |
| :--- | :--- | :--- | :--- | :--- |
| **EdgeRelax** | `src/physics/engine/constraints.ts` | L28-182 | Linear spring correction | **DISABLE**. Replace with `DistanceConstraint`. |
| **Spacing** | `src/physics/engine/constraints.ts` | L184-452 | Soft/Hard Repulsion zone | **DISABLE**. Replace with `ContactConstraint`. |
| **TriangleArea** | `src/physics/engine/constraints.ts` | L454-616 | Area conservation | **PORT**. Move to `AreaConstraint` or `VolumeConstraint`. |
| **SafetyClamp** | `src/physics/engine/constraints.ts` | L618-741 | Hard overlap resolver | **DISABLE**. XPBD handles this via stiff constraints. |

---

## 5. Velocity Modifiers (`node.vx/vy = ...`)
These run *after* forces (and some *after* integration). They act as "Motors" or "Annealers".

| System | File Location | Range | Logic | XPBD Action |
| :--- | :--- | :--- | :--- | :--- |
| **DragVelocity** | `src/physics/engine/velocity/dragVelocity.ts` | (module) | Input momentum | **KEEP**. Logic resides in Input. |
| **ExpansionRes** | `src/physics/engine/velocity/expansionResistance.ts` | (module) | `v *= (1-k)` if moving out | **KEEP**. Good for stability. |
| **AngleRes** | `src/physics/engine/velocity/angleResistance.ts` | L6-163 | `vx += tangent` | **KEEP**. This is a "Bend Constraint" acting on velocity. Valid in XPBD as a standard Bend Constraint, or keep as V-Mod styling. |
| **DistBias** | `src/physics/engine/velocity/distanceBias.ts` | L5-171 | `vx -= inward` | **KEEP/REVIEW**. Acts as "Velocity Contact Constraint". XPBD handles this via restitution/friction. Can cause "ghost collisions" if kept active with XPBD. |
| **MicroMods** | `src/physics/engine/velocity/*.ts` | Multiple | De-locking, Phase Diffusion | **KEEP**. These break symmetry and prevent crystallization. XPBD is robust to them. |

---

## 6. Write Ownership Proof
**Who owns `node.x` / `node.y`?**

1.  **Physics Tick Start**: Positions are "Old" (previous frame).
2.  **Integration (Line 641)**: `node.x += node.vx * dt`. **PRIMARY UPDATE**.
    *   *Proof*: `src/physics/engine/integration.ts` L184-185.
3.  **Corrections (Line ~800+)**: `node.x += diff`. **CONSTRAINT SOLVER**.
    *   *Proof*: `src/physics/engine/corrections.ts` L353-354 (Self) and L496-497 (Diffused).
4.  **Canary (Line ~900)**: `node.x += 30` (If enabled).
    *   *Proof*: `src/physics/engine/engineTick.ts` (Our injection).
5.  **Render Loop**: `node.x = input.x` (For Dragged Node ONLY).
    *   *Proof*: `src/playground/rendering/graphRenderingLoop.ts` L199-200.

**Conclusion**:
-   **Normal Nodes**: Owned by `integrateNodes` (Predict) -> `applyCorrections` (Correct).
-   **Dragged Node**: Owned by `RenderLoop` (Overridden every frame).

---

## 7. Conflict Matrix (Dual-Solver Risks)
Leaving these enabled alongside XPBD will cause "Fighting" (Jitter/Explosion).

| Legacy System | XPBD Analogue | Result of Co-Existence |
| :--- | :--- | :--- |
| `applySprings` (Force) | `DistanceConstraint` | **Double Stiffness**. Springs will fight constraints. Frequency mismatch = Resonance. |
| `applySpacingConstraints` | `ContactConstraint` | **Ghost Collisions**. PBD accumulator vs XPBD instantaneous projection. |
| `applyEdgeRelaxation` | `DistanceConstraint` | **Redundant**. PBD version is just a weak constraint. |
| `applyDistanceBiasVelocity` | `ContactConstraint` (Friction) | **Sticky Walls**. Velocity bias might prevent XPBD contact resolution from settling. |

**Recommendation**:
1.  **Disable** all Force-Springs and PBD-Constraints when `useXPBD` is true.
2.  **Keep** Repulsion (Force) for long-range "Soft" feeling, but use XPBD for hard contact ranges.
3.  **Keep** Gravity/Boundary (Global Forces).
4.  **Keep** V-Mods (Annealing) but tune down if XPBD is stiff.
