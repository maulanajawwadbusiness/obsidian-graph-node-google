# Physics Move Leak Fixes (Phase 6): Mode Law, Residuals, Hub Lag
**Fixes #16, #17, #18**
**Date:** 2026-01-30

## 1. Problem Statement
The "Real Move Leak" persisted in edge cases involving mode transitions and budgeting.
*   **Fix 16 (Mode Transition Flux)**: Switching modes (e.g. fatal/normal) changes the constraint laws (frequency/budget), releasing latent pressure ("flush") and causing jumps.
*   **Fix 17 (Correction Budget Drift)**: When per-node corrections were capped (budget), the "unpaid" correction was discarded, leading to a slow, persistent drift as the system tried to pay off the error in tiny increments indefinitely.
*   **Fix 18 (Hub Lag Tail)**: Low-pass filtering on hub forces created an asymptotic "ghost slide" effect where nodes kept moving long after forces stabilized.

## 2. Implementation Details

### Fix 16: Mode Transition Safety
*   **Invalidation**: Updated `invalidateWarmStart` (which runs on mode switch via `setDegradeState`) to explicitly clear `correctionResidual`.
*   **Outcome**: When laws change, we wipe the slate clean (no old impulses, no old debt). This ensures the new mode starts fresh, preventing the release of stored pressure from the old regime.

### Fix 17: Explicit Correction Debt
*   **Tracking**: Added `correctionResidual` to `PhysicsNode`.
*   **Logic**: In `corrections.ts`, if a node's correction is clipped by `nodeBudget`:
    *   We calculate the exact unpaid vector (`remDx`, `remDy`).
    *   We store it in `correctionResidual` for the next frame (with 0.8 decay to ensure convergence).
    *   In the next frame, this debt is added *before* budget checks.
*   **Result**: Instead of drifting forever, the debt is acknowledged and paid off as budget permits, or decays gracefully.

### Fix 18: Hub Lag Snap
*   **Snap**: In `integration.ts`, inside the hub low-pass filter logic:
    *   If current forces are negligible (`abs(fx) < 0.01`), we **snap** the filter state (`effectiveFx`) to current force immediately.
    *   We also reset the history (`prevFx`) to match.
*   **Result**: When forces stop, motion stops. No "ghost slide" from the filter tail.

## 3. Verification
1.  **Mode Switching**:
    *   Toggle between Normal and Stressed. Graph should not jump or shift. (Handled by strict cache/debt clearing).
2.  **Drift**:
    *   In dense/stiff graphs where budget clipping occurs, nodes should find equilibrium quickly rather than crawling.
    *   Logs will show `[CorrCap]` budget hits, but debt repayment ensures it resolves.
3.  **Hub Stop**:
    *   Drag a hub and release. It should settle crisply without a long asymptotic tail.

## 4. Files Modified
*   `src/physics/types.ts`: Added `correctionResidual`.
*   `src/physics/engine.ts`: Cleared residual on invalidation.
*   `src/physics/engine/corrections.ts`: Implemented debt logic.
*   `src/physics/engine/integration.ts`: Implemented tail snapping.
