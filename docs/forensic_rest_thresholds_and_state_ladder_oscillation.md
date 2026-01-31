# Forensic Report: Rest Thresholds & State Ladder Oscillation

**Date:** 2026-02-01
**Subject:** Rest detection strictness and missing state machine logic.

## 1. Findings

### A. Broken State Machine
The logic to update `settleState` (Moving -> Cooling -> Sleep) was found to be **partially deleted** or disconnected in `engineTick.ts` during recent edits.
-   `newState` is initialized to `'moving'` but the conditional logic to switch to `'cooling'` or `'sleep'` is missing in the current version.
-   **Consequence:** The system may report 'moving' indefinitely or rely on legacy fallbacks, preventing proper sleep transitions.

### B. Threshold Strictness
-   **Rest Candidates:** require `speed < minSpeed`, `force < minForce`, `pressure < minPressure`.
-   **Current logic:** `fRestCandidates` counts nodes meeting these strict criteria.
-   **Issue:** If even a few nodes fail (outliers), `sleepRatio` never reaches 1.0 (or 0.99), preventing global sleep.

### C. Oscillation Risk
-   `motionPolicy` uses `settleScalar` based on `avgVelSq` (smoothstep 0.0001 - 0.01).
-   Without a state machine with hysteresis (time-based confidence), the system can flap between "Active" and "Settle" modes if velocity hovers near 0.01 px/frame.

## 2. Recommendation

### A. Adaptive Thresholds
-   Implement `isSafeToSleep(node)`:
    -   `speed < 0.05` (relaxed from 0.01?)
    -   `pressure < 0.2` (correction magnitude)
    -   `jitter < 0.1`

### B. Confidence-Based State Machine
-   Introduce `settleConfidence` (EMA).
    -   Rule: If `calmPercent > 95%`, increase confidence. Else decrease.
-   **Ladder:**
    -   **Moving:** Confidence < 0.5.
    -   **Cooling:** Confidence > 0.5 (Trigger: 0.5s warmup).
    -   **Sleep:** Confidence > 0.9 (Trigger: 2.0s stable).
-   **Hysteresis:** To wake up, confidence must drop below 0.2 significantly.

### C. Reset Logic (Single Writer)
-   All state changes must go through a single function `updateSettleState()`.
-   Timers reset only on: Drag, Interaction, or Confidence Drop.

## 3. Plan

1.  **HUD:** Add "Rest Blockers" and "Outlier Count" to verify what stops sleep.
2.  **Fix:** Re-implement `updateSettleState` in `engineTick.ts`.
3.  **Logic:** Use `settleConfidence` accumulator instead of instantaneous `sleepRatio`.
