# Forensic Plan: Repulsion & Collision placement
**Date:** 2026-02-01
**Status:** ARCHITECTURE DRAFT

## 1. Current System Map
| System | Type | Logic | O(N) Estimate |
| :--- | :--- | :--- | :--- |
| `applyRepulsion` | Force | Pairwise (N^2) or NeighborCache. Soft 1/d force. | High |
| `applyCollision` | Force | Pairwise (Strided). Hard spring force. | Medium |
| `applySpacingConstraints` | PBD | Pairwise (Strided). Position projection. | Medium |
| `applySafetyClamp` | PBD | Pairwise (Strided). Hard limit. | Medium |

**Problem:** Four separate N^2 loops doing roughly the same thing (keeping nodes apart).
**Risk:** XPBD `ContactConstraint` adds a 5th loop.

## 2. XPBD Integration Strategy
We will consolidate these into **Two Layers**:
1.  **Soft Layer (Repulsion Force)**: Kept for "Vibe" / "Cluster Shape".
2.  **Hard Layer (XPBD Contact)**: Replaces Collision + Spacing + SafetyClamp.

### Placement in Tick
1.  **Broadphase**: Build Spatial Grid (Once).
2.  **Forces**:
    -   `applyRepulsion` (Soft) -> uses Grid.
    -   `applyGravity`, `applyBoundary`.
3.  **Integration**: Prediction (`x' = x + v*dt`).
4.  **XPBD Loop**:
    -   `DistanceConstraint` (Links).
    -   `ContactConstraint` (Collisions) -> uses Grid.
5.  **Velocity Update**: `v = (x' - x) / dt`.

## 3. Performance Plan (The "Grid")
To avoid O(N^2) death with the new Contact Constraint:

**Single Truth Spatial Hash:**
-   **Cell Size:** `130px` (LinkRestLength). Fits most interaction radii.
-   **Structure:** `Map<CellKey, NodeID[]>`.
-   **Lifecycle:** Rebuilt **ONCE** at start of `runPhysicsTick`.
-   **Usage:**
    -   **Repulsion**: Query 3x3 cells.
    -   **Contact**: Query 3x3 cells.
    -   **Density**: Query 3x3 cells.

**Benefit:**
-   Reduces N^2 to N*K (where K is average neighbors, ~5-10).
-   Consistent neighborhood for all systems.

## 4. Disabling Legacy Systems
To prevent "Dual-Solver" fighting during transition:
-   **DISABLE**: `applyCollision` (Force-based hard shell).
-   **DISABLE**: `applySpacingConstraints` (PBD-based soft shell).
-   **DISABLE**: `applySafetyClamp` (PBD-based hard shell).
-   **KEEP**: `applyRepulsion` (Force-based long range).
    -   *Tune*: Ensure repulsion `minDistance` matches XPBD contact radius (`100px`) to hand off gracefully.

## 5. Continuity & Jitter
-   **Hysteresis**: XPBD Contact needs a small "separation buffer" (rest + 2px) vs "contact radius" (rest) to prevent jitter at rest.
-   **Warm Start**: Keep `lambda` (constraint multipliers) persistent to maintain stacking stability.

## 6. Execution Plan
1.  Implement `SpatialGrid` class.
2.  Modify `applyRepulsion` to use `SpatialGrid`.
3.  Implement `ContactConstraint` using `SpatialGrid`.
4.  Switch `config.ts` to disable legacy collision/spacing when XPBD is active.
