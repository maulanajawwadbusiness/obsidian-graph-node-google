# Forensic Report: Over-constrained Systems & Triangle Degeneracy

## 1. Constraint Inventory
1.  **Triangle Area** (`constraints.ts`: `applyTriangleAreaConstraints`)
    -   **Type**: PBD (Soft Position Correction).
    -   **Logic**: Calculates $Area = |(B-A) \times (C-A)| / 2$. Compares to `restArea`. Pushes vertices outward along altitude if too small.
    -   **Strength**: `0.0005 * energy * dt`. Fades as system cools.
    -   **Degeneracy Guard**:
        -   `if (d < 0.1) continue` (Altitude length guard).
        -   `correction = min(correction, 2.0 * dt)`.
        -   Ramp down if `area < 5.0`.
    -   **Risks**:
        -   `d < 0.1` (0.1px) is very small. Normalization `dx/d` becomes unstable.
        -   If points are collinear, `d` is 0.
        -   If triangle is inverted? `abs` handles scalar area, but direction might flip.

2.  **Distance Constraints** (`forces.ts`: `applySpringConstraint`)
    -   **Type**: PBD (Hard-ish Snap).
    -   **Logic**: Moves nodes to `restLength`.
    -   **Strength**: Configurable (default 0.5/frame).

3.  **Spacing Constraints** (`constraints.ts`: `applySpacingConstraints`)
    -   **Type**: PBD (Inequality: $d > D_{hard}$).
    -   **Logic**: Pushes apart if too close.

## 2. Over-constraint Forensics
-   **Architecture**: All PBD constraints accumulate into `correctionAccum`.
-   **Resolution**: `corrections.ts` solves `accum`.
-   **Budgeting**: If `|accum| > nodeBudget`, the correction is clipped (scaled down).
-   **The Problem**:
    -   If Links want to pull IN, and Spacing wants to push OUT, they sum to near zero (equilibrium) OR they fight.
    -   If they fight and exceed budget, they get clipped.
    -   If "Correction Debt" (`correctionResidual`) is preserved, it might pile up.
    -   Currently `correctionResidual` decays (`* 0.8`), which is good.
    -   **Perpetual Motor Risk**: If the compromise position is unstable, or if the "Unpaid Debt" release kicks the system into a new collision state next frame.

## 3. Degeneracy Plan
1.  **Robust Area Check**:
    -   Increase epsilon for altitude check (e.g., `0.5` px).
    -   If degenerate (collinear), skip correction or apply "safe unfold" (random tiny nudge?).
    -   Clamp `maxTriCorrection` further.
2.  **HUD Metrics**:
    -   Track `degenerateTriCount` (area < eps).
    -   Track `clippingCount` (budget hits).

## 4. Relaxation Strategy
-   The solver creates "Stress" when budget is hit.
-   If `clippingCount` is high for a node, we should temporarily reduce its constraint participation?
-   Simpler: Use `compliance`.
-   Instead of rigid `strength`, define `stiffness / (stiffness + correction)`.
-   Or just: **Feedback Loop**. If `stats.safety.correctionBudgetHits` is high, globally damp constraint strength for next frame.
    -   "Adaptive Solver".
