# XPBD Run 1: Mini Run 4 - Distance Solver V1

## Goal
Implement the minimal XPBD distance constraint solver (single iteration) with truthful telemetry, inventory validation, and ghost velocity containment.

## Changes

### 1. Inventory Validation
-   **Location**: `src/physics/engine/engineTickXPBD.ts` -> `rebuildXPBDConstraints`.
-   **Logic**:
    -   Checks for missing nodes (endpoint validation).
    -   Checks for non-finite `restLen`.
    -   Checks for `restLen <= 0`.
    -   **Result**: Valid metrics surfaced on HUD (`inv`, `inf`, `0len`).

### 2. Solver V1 Implementation
-   **Location**: `src/physics/engine/engineTickXPBD.ts` -> `solveXPBDEdgeConstraints`.
-   **Math**:
    -   **Constraint**: $C = dist - restLen$
    -   **Compliance**: $\alpha = \frac{compliance}{dt^2}$ (Using hardcoded `compliance = 0.1`)
    -   **Corrections**: Standard XPBD $\Delta\lambda$ and position updates.
    -   **Iteration**: Single pass (Iter = 1).
    -   **Units**: Pure World Space pixels.

### 3. Safety Features
-   **Ghost Velocity Containment**: `ADJUST_PREV_ON_SOLVE = true`.
    -   When updating $x$ and $y$, we perform the *exact same* update to $prevX$ and $prevY$.
    -   This prevents the velocity reconstruction step ($v = \frac{x - prevX}{dt}$) from seeing the position correction as a massive velocity spike.
    -   **HUD Metric**: `safe: [N]` (Count of nodes adjusted).

### 4. Telemetry (Truthful)
-   **Solved**: Actual number of constraints processed in the loop (excluding invalid).
-   **ErrAvg**: $\frac{\sum |dist - restLen|}{count}$.
-   **CorrMax**: Maximum displacement applied to any node in the frame.
-   **Timing**: `solveMs` measures *only* the solver loop.

## Verification Checklist

### Manual Verification
1.  **Launch App**:
    -   **HUD**: "XPBD Springs" block visible.
    -   **Inventory**: `inv: 0 | inf: 0 | 0len: 0`.
2.  **Interaction**:
    -   **Spawn**: Nodes should expand/contract to meet rest lengths.
    -   **Drag**:
        -   Drag a node. Connected neighbors should pull towards it (elasticity).
        -   `errAvg`: Should increase during drag stretch.
        -   `corrMax`: Should spike during drag.
        -   `safe`: Should increment (reflecting prev-adjustments).
3.  **Behavior**:
    -   Movement should be "springy" but potentially soft (1 iter, compliance 0.1).
    -   No explosions (thanks to prev-adjust).

## Constants
-   `EPSILON`: 1e-6 (Singularity check)
-   `compliance`: 0.1 px/N (Soft)
-   `ADJUST_PREV_ON_SOLVE`: true

## Next Steps
Proceed to **Mini Run 5**: Full Reconcile & Multi-Iteration (Stiff Springs).
