# System.md Refresh: Holy Grail Physics

## 1. Summary
Refreshed `docs/system.md` to establish the new "Holy Grail" architecture as the canonical truth. This replaces old assumptions about simple energy gating with the robust **Degrade-1:1** and **0-Slush** policies.

## 2. Changes Made
*   **Scheduler**: Explicitly documented the **Overload Failure Mode** (Drop Debt/Brief Stutter).
    *   Defined the triggers: `DT_HUGE`, `DEBT_WATCHDOG`, `BUDGET_EXCEEDED`.
*   **Degrade Policy**: Replaced vague "throttling" with the strict **Bucket A/B/C Policy** ("No Mud").
    *   Bucket A: Integration, Local Boost (Sacred).
    *   Bucket B: Springs/Repulsion (Frequency reduced, stiffness normalized).
    *   Bucket C: Far-field Spacing (Aggressive throttle).
*   **Observability**: Added the new telemetry keys `[Overload]`, `[Degrade]`, `[Hand]`, `[SlushWatch]`.
*   **Entrypoints**: Added a "Where to Edit" section pointing to `useGraphRendering.ts` (Scheduler) and `engine.ts` (Pass Logic).

## 3. Risks / TODO
*   **Visual Verify**: The logic is sound, but developers should verify `[Hand] lagP95Px` remains near 0.00 during heavy loads to prove the "Local Boost" bubble is working.
*   **Constants**: The 250ms `dtHuge` threshold and 2-frame `debtWatchdog` are soft-coded in `config.ts` and `useGraphRendering.ts` respectively. Future tuning might move these to a unified config.
