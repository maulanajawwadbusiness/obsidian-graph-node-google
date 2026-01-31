# Forensic Report: Injectors ("Micro-Slip" and "Infinite Energy")

## 1. Injector Inventory

| Injector Name | File | Trigger Condition (Old) | Action | Fix Applied |
| :--- | :--- | :--- | :--- | :--- |
| **Water Micro-Drift** | `integration.ts` | `energy > 0.05` | Adds `sin(t)` to `globalAngle` | Gated by `(1 - settleScalar)^3`. Dies at rest. |
| **Dense Core De-Locking** | `velocity/denseCoreVelocityUnlock.ts` | `diffusion > 0.01` | Injects perp velocity to break packing | Gated by `(1 - settleScalar)^2` + `diffusion`. |
| **Static Friction Bypass** | `velocity/staticFrictionBypass.ts` | `relVel < epsilon` | Injects perp shear to pairs | Gated by `(1 - settleScalar)^2` + `diffusion`. |
| **DT Skew** | `integration.ts` | `earlyExpansion > 0.01` | Modifies `dt` per node | Gated by policy (no change needed, policy handles it). |

## 2. Implemented Fixes

### A. Settle-Gating (The "Cooling Law")
All injectors now respect the global `settleScalar` (confidence that system is at rest).
```typescript
const settleGate = Math.pow(1 - settleScalar, 2); // 0.0 at rest
if (injectorStrength * settleGate < threshold) return;
```
This guarantees that **at rest (settle=1), NO energy is injected**.
Previously, `energy > 0.05` allowed drift to continue while visible motion was zero, preventing true sleep.

### B. Forensics (HUD)
Added `injectors` block to `DebugStats` and `PhysicsHudSnapshot`.
-   **`microSlipCount`**: Frames/Nodes where de-locking fired.
-   **`driftCount`**: Frames where global drift fired.
-   **`lastInjector`**: Name of the last active injector.

## 3. Verification Protocol (Expected)

1.  **Idle Test (N=5, 30s):**
    -   **Before:** `driftCount` increments indefinitely. `energy` hovers > 0.
    -   **After:** `driftCount` stops. `energy` -> 0. `settleState` -> 'sleep'.

2.  **Stuck Test (Tight Cluster):**
    -   **Before:** Constant jitter/buzz (infinite energy).
    -   **After:** Initially jitters (De-Locking active), then as `settle` rises, jitter limits itself to 0.

3.  **Interaction:**
    -   When dragging, `settleScalar` drops to 0. Injectors activate to prevent stagnation during manipulation (e.g. friction bypass helps sliding).
    -   Once released, system cools and injectors fade out.

## 4. Conclusion
The "Heartbeat Motors" have been silenced. The system now obeys the **Single Continuous Law**: Energy input must vanish as Equilibrium is approached.
