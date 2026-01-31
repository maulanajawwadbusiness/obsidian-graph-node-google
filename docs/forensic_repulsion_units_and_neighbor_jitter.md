# Forensic Report: Repulsion Units & Neighbor Jitter

**Date:** 2026-02-01
**Subject:** Physics Invariance & Stability Analysis

## 1. Executive Summary
We investigated the physics engine to determine if repulsion forces are dependent on camera zoom (screen-space) and identified the root cause of dense-cluster jitter.
**Findings:**
- **Coordinate System:** The physics engine (`forces.ts`, `constraints.ts`) operates entirely in **World Units**. No explicit "Screen Space" or "Zoom" variables were found injected into the physics kernel parameters (`ForceConfig`).
- **"Screen Clamp" Hypothesis:** The user suspected clamps were in screen pixels. We found `maxCorrectionPerFrame` (1.5) and `repulsionMaxForce` (1200) are nominally World Units. If 1.5 world units seems small/large at different zooms, it's a visual perception issue, not a physics variance. However, to guarantee invariance, we will strictly rename/enforce "World" suffix on all such constants.
- **Neighbor Jitter ({High Confidence}):** The "micro-pushes" at rest are caused by the **stateless integer density count** in `applyRepulsion`. A neighbor drifting across the `densityRadius` (25.0) boundary causes the `count` to flip (N <-> N+1), causing a discrete jump in `densityBoost` (Force), kicking the node.

## 2. Coordinate Space Map & Anchors

| Parameter | Current Value | Unit System | Location | Assessment |
| :--- | :--- | :--- | :--- | :--- |
| `repulsionStrength` | 500 | World (F ~ k/d) | `config.ts` | **Invariant**. |
| `repulsionMaxForce` | 1200 | World (Force) | `forces.ts` | **Invariant**. Value is constant. |
| `maxCorrectionPerFrame` | 1.5 | World (Dist/Frame) | `constraints.ts` | **Invariant**. 1.5 units is constant in world. |
| `densityRadius` | 25 | World (Dist) | `forces.ts` | **Invariant**. |
| `softMaxCorrectionPx` | 2.0 | World (Dist) | `config.ts` | **Invariant**, despite "Px" suffix. |

**Invariance Verdict:** The physics engine is **already invariant** to camera zoom, as it has no access to the camera transform.
*Action:* We will rename `...Px` variables to `...World` to permanently disambiguate and prevent future screen-space regressions.

## 3. Neighbor Jitter Root Cause
**Mechanism:**
1. `applyRepulsion` counts neighbors within `densityRadius` (25.0).
2. Code: `if (dist < 25) count++`.
3. If distance is 25.0001, count is N. If 24.9999, count is N+1.
4. `densityBoost` scales repulsion by `1 + 0.3 * (count - 2)`.
5. A single neighbor flicker causes a ~30% force jump (if count is low).
6. This kicks the node, changing distance, repeating the cycle -> **Perpetual Jitter**.

**Solution: Hysteresis**
We must make the "Neighbor" state sticky.
- **Enter:** `dist < 25.0`
- **Exit:** `dist > 27.5` (10% margin)
- Requires maintaining `neighborState` across frames.

## 4. Fix Plan
1.  **DevTools:** Add "Forensic: Repulsion" HUD to show `repulsionClampValueWorld` and `neighborReorderRate`.
2.  **Units:** Rename `softMaxCorrectionPx` -> `softMaxCorrectionWorld`. Verify logic.
3.  **Stability:** Implement `NeighborCache` in `PhysicsEngine` and pass to `applyRepulsion`.
    -   Cache `Set<string>` of neighbors for each node.
    -   Update cache with hysteresis rules.
    -   Use cached count for density.

## 5. Verification Protocol
-   **Zoom Test:** Change zoom 0.5x -> 2.0x. Physics should be identical.
-   **Rest Test:** Settle a dense cluster. `neighborReorderRate` should hit 0. Nodes should be stationary (no pixel shimmer).
