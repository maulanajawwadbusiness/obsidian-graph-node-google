# Physics Forensics: Fragmentation & Unification Analysis

**Date**: 2026-01-31
**Target**: `src/physics` (Engine, Forces, Velocity, Constraints)
**Objective**: Identify fragmentation, patches, and scale-dependent inconsistencies.

## 1. Executive Summary: "The Patchwork City"
The physics engine is currently a collection of ~12 disjointed "micro-solvers" rather than a unified field theory. While individual behaviors (like "hub softening" or "inertia relaxation") are clever, they are implemented as isolated files with hardcoded thresholds ("Magic Numbers") that create chemically separated behaviors at different scales.

**Verdict**: The "Knife-Sharp Precision" goal is blocked by:
1.  **Mode-Switching Schisms**: Physics laws change fundamentally at N=250 and N=500 (`perfMode`).
2.  **Linear Conflict**: Force updates and Constraint corrections often fight each other in the same frame.
3.  **Magic Number Dependency**: Behaviors rely on hardcoded constants (e.g., `densityRadius=30`, `deg>2`) that do not scale with graph size.

## 2. Forensic Findings

### A. Scale-Dependent Behavior (The "5 vs 60" Problem)
The code explicitly changes rules based on node count, leading to inconsistent "feel":

| Mechanism | Threshold | Effect | Implication |
| :--- | :--- | :--- | :--- |
| **Triangle Area** | `perfMode` != Fatal | Turns OFF in Fatal mode | Large graphs look "flatter" and less organic than small ones. |
| **Spacing Freq** | `degradeLevel` | 1 -> 2 -> 3 frames | Large graphs have "softer/laggy" repulsion compared to small graphs. |
| **Hub Scaling** | `deg > 2` | 30% drag increase | 2-degree nodes feel "light", 3-degree nodes feel "heavy". Binary switch. |
| **Density Check** | `count >= 4` | Triggers "Dense Core" logic | "Crowded" behavior kicks in abruptly at neighbor count 4. |

### B. The Velocity "Patchwork" (`velocityPass.ts`)
The standard Euler integration is intercepted by **12 separate modifiers**, each fixing a specific edge case:
1.  **`start/stop`**: `applyPreRollVelocity`, `applyStaticFrictionBypass`
2.  **`stuck`**: `applyDenseCoreInertiaRelaxation` (Flocking), `applyEdgeShearStagnationEscape` (Perpendicular Kick)
3.  **`shape`**: `applyHubVelocityScaling` (Structure), `applyAngleResistanceVelocity` (Grid)
4.  **`damp`**: `applyDragVelocity` (General), `applyExpansionResistance` (Explosion Guard)

**Issue**: These run linearly. A "kick" from Patch #2 might be damped by Patch #4. The order is brittle.

### C. Conflicting Primaries (`constraints.ts` vs `forces.ts`)
*   **Forces (Soft)**: "Push A away from B" (Repulsion).
*   **Constraints (Hard)**: "Pull A toward B" (Springs).
*   **Conflict**: In `engineTick.ts`, we compute forces, *then* integrate velocity, *then* apply constraints.
    *   Result: A node can be pushed 10px by repulsion, then snapped back 9px by constraints in the same frame. This creates "vibration" or "micro-drift" energy that requires *more* patches (damping) to kill.

### D. "Ghost" Patches
Several mechanisms are "hidden" inside conditional logic:
*   **Early-Phase Privilege**: `if (energy > 0.85)` blocks exist in `constraints.ts` and `velocityPass.ts`. Physics laws effectively change after the first ~2 seconds.
*   **Hand Priority**: `if (draggedNodeId === ...)` blocks in constraints hardcode "softness" near the user's hand. This should be a unified force property, not a constraint-level `if`.

## 3. Unification Strategy (Proposed)
To achieve "Knife-Sharp" unity, we must move from **Patching** to **Unifying**:

1.  **Unified Solver**: Replace separate Force/Constraint passes with a single **Verlet-integration** or **PBD-first** approach where constraints *are* the forces.
2.  **Scale-Free Constants**: Remove `30px` radii. Use relative units (e.g., `radius * 2`).
3.  **Continuous Degradation**: Instead of binary "On/Off" switches for Triangle/Spacing, use a continuous scalar (`budgetScale 0.0 -> 1.0`).
4.  **State-Driven Rules**: Replace `if (energy > 0.85)` with a continuous `temperature` variable that governs all "plasticity".

## 4. Critical "Keepers" (Behaviors to Preserve)
Despite the mess, these distinct behaviors are valuable and must be preserved in the unified model:
*   **Stagnation Escape**: The "perpendicular slip" is brilliant for preventing jammed triangles.
*   **Hub Drag**: High-degree nodes *should* differ from leaves to anchor the graph.
*   **Local Boost**: The "Interaction Bubble" where the user touches effectively "upgrades" physics fidelity is essential for perceived performance.

## 5. File Map of Shame
*   `src/physics/engine/velocity/edgeShearStagnationEscape.ts`: Peak "magic number" density.
*   `src/physics/engineTick.ts`: The "Manager" that manually toggles features based on Mode.
*   `src/physics/config.ts`: Contains hardcoded thresholds like `perfModeNStressed`.
