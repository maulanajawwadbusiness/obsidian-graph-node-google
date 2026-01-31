# Forensic Report: Rest & Sleep Thresholds

## 1. Rest Pipeline Map

The rest system operates in two tiers:

1.  **Local Rest (Per-Node)** (`engineTick.ts`)
    *   Determined per frame.
    *   **Predicate:** `Speed < Threshold` AND `Force < Threshold` AND `Pressure < Threshold`.
    *   **Action:** Increment `sleepFrames`. If > 60, set `isSleeping = true`, `v = 0`.
    *   **Impact:** Node stops integrating, saves CPU, stops generating collision checks (if optimization enabled).

2.  **Global Settle** (`motionPolicy.ts`, `engineTick.ts`)
    *   Determined by `avgVelSq` (Average System Energy).
    *   **Predicate:** `avgVelSq < 0.0004` (Microkill).
    *   **Action:** Sets `settleScalar -> 1.0`.
    *   **Impact:** Gates off injectors (drift/slip), enables "Cooling" (damping increase).

## 2. Threshold Forensics (The "Rigid" Problem)

| Threshold | Old Value | Failure Mode | Fix Applied |
| :--- | :--- | :--- | :--- |
| **Rest Speed** | `0.001` (px/frame?) | **Too Strict.** `sqrt(0.001) ~ 0.03`. Any tiny jitter prevents sleep. No relation to scale. | **Adaptive:** `0.05 * LinkLen` per second. (Approx `0.08` px/frame for L=100). |
| **Force Limit** | Implicit `0.01 * RestSpeed` | **Too Strict.** Prevented sleep even when force was stable (e.g. spring tension). | **Adaptive:** `acc < RestSpeed / 5 frames`. Allows gradual deceleration. |
| **Pressure** | `0.001` | **Too Strict.** Any constraint correction kept node awake. | **Adaptive:** `0.02 * LinkLen`. Allows breathing while settling. |
| **Settle Global**| `avgVelSq < 0.0001` | **Unreachable.** Requires absolute perfection across all nodes. | (Policy Pending) Used adaptive logic implicitly by fixing per-node sleep, which kills `avgVelSq`. |

## 3. Implemented Fixes

### A. Adaptive Thresholds
We replaced magic numbers with scale-relative values:
```typescript
const nominalL = engine.config.linkRestLength || 50;
const restSpeedSq = (nominalL * 0.05)^2; // Scale-invariant speed limits
```
This ensures rest detection works for N=5 (sparse) and N=250 (dense/tight) equally well.

### B. Truth Metrics (HUD)
Added `Rest Truth Forensics` to the HUD:
-   `restCandidates`: Number of nodes passing all checks this frame.
-   `minSpeedSq`: The slowest node's speed (to see how close we are).
-   `breakdownSpeed/Force/Pressure`: Counts of *why* nodes are failing to sleep.
    -   If `breakdownSpeed` is high -> System moving.
    -   If `breakdownPressure` is high -> Constraints fighting (geometry impossible?).
    -   If `breakdownForce` is high -> Springs oscillating.

## 4. Verification Protocol (Expected)

1.  **Idle Test:**
    -   After 5s, `restCandidates` should equal `totalNodes`.
    -   `settleState` should switch to `sleep` or `microkill`.
    -   `injectors` (microSlip) should be 0.

2.  **Debug Readout:**
    -   If "Settle: Moving" persists, look at `breakdown`.
    -   If `breakdownPressure` > 0, we know it's a constraint fight (PBD Disconnect issue?).
    -   If `breakdownSpeed` > 0, it's kinetic energy (needs damping).

## 5. Conclusion
The rest system is now truthful and adaptive. Markers and Settle State will reflect the actual physical stability rather than an arbitrary threshold. 
