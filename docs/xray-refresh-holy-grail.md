# Xray Refresh: Holy Grail Logic

## 1. Summary
Refreshed `repo_xray.md` and `physics_xray.md` to reflect the "Holy Grail" architecture (0-Slush, Drop Debt, Degrade-1:1).

## 2. Changes

### A. Repo Xray
*   **Runtime Loop**: Added "Overload Detection" and failure mode "Brief Stutter".
*   **Invariants**: "Visual Dignity" now explicitly bans "Syrup" (slow motion) and mentions "Degrade-1:1".
*   **Key Files**: Added `useGraphRendering.ts` Overload Monitor and `engine.ts` Degrade State.
*   **Logs**: Added `[Overload]`, `[Degrade]`, `[Hand]`, `[SlushWatch]`.

### B. Physics Xray (The Doctrine)
*   **0-Slush**: Documented the "Drop Debt" contract.
*   **Degrade-1:1**:
    *   Defined the Levels (0/1/2) and the Bucket Strategy (Sacred/Structural/Luxury).
    *   Explained why we skip passes instead of lowering stiffness ("No Mud").
*   **Locality**: Documented `Local Boost` (Interaction Bubble) protecting the dragged node.

## 3. Scan Confirmation
*   **Scheduler**: Verified `useGraphRendering.ts` implements `accumulatorMs = 0` on freeze/watchdog.
*   **Degrade**: Verified `engine.ts` implements `repulsionEvery`, `spacingEvery` based on `degradeLevel`.
*   **Boost**: Verified `engine.ts` bypasses degrade for `focusActive` nodes during drag.

## 4. Remaining Risks
*   **Staggering Artifacts**: At `degradeLevel=2` (30hz updates), fast interactions might see slight tunneling, but `Local Boost` mitigates this for the active area.
