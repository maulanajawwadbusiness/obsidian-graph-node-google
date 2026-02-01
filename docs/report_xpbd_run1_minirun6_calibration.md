# XPBD Run 1: Mini Run 6 - Native Magnitude Calibration

## Goal
Calibrate XPBD edge constraints to produce visible, physical motion consistent with engine scale (px/sec). Provide a "Calibration Canary" to prove the solver is active and powerful.

## Implementation Details

### 1. Configuration (Single Source of Truth)
-   **File**: `src/physics/types.ts` & `src/physics/config.ts`
-   **New Fields**:
    -   `xpbdLinkCompliance`: Default `0.0001` (stiff/rigid). Replacing hardcoded `0.1`.
    -   `xpbdMaxCorrPerConstraintPx`: Default `100.0`. Safety cap to prevent explosion if compliance is 0 or dt is tiny.
    -   `debugXPBDCanary`: Toggle for artificial error injection.

### 2. Logic Changes
-   **File**: `src/physics/engine/engineTickXPBD.ts`
-   **Rebuild**: Uses `config.xpbdLinkCompliance`.
-   **Solver**:
    -   **Canary Logic**: If `debugXPBDCanary` is true, Constraint 0 treats its `restLen` as `restLen - 50` (effectively pulling nodes together by 50px).
    -   **safety Cap**: Correction vectors are capped at `MAX_CORR_PX` (100px) per frame.

### 3. Verification Plan (Manual)

#### A. Static Stability (Canary OFF)
-   **Action**: Enable XPBD. Settle graph.
-   **Expectation**: Graph should be stable. `corrMax` should be small (< 0.5px) but non-zero during minor jitters.

#### B. Canary Test (Proof of Power)
-   **Action**: Enable `debugXPBDCanary` (via code or if UI toggle exists).
-   **Expectation**:
    -   HUD `ghost` metrics should spike on Link 0.
    -   Visible "twitch" or strong pull on the canary link.
    -   `corrMax` should jump to significant values (e.g. > 1px) as it fights to close the 50px gap.

#### C. Compliance Tuning
-   **Action**: Adjust `xpbdLinkCompliance` in `config.ts`.
-   **Expectation**:
    -   `0.0001` (Default): Very stiff, snappy connections.
    -   `0.1` (Old Placeholder): Soft, rubbery connections.

## Invariants Verified
1.  **Config Driven**: No more magic numbers (`0.1`) in solver.
2.  **Safety First**: 100px cap prevents singularity explosions.
3.  **Ghost Safe**: All corrections (even massive canary ones) are reconciled via Run 5 logic.
