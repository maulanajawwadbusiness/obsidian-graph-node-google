# Forensic Report: Spawn & Startup Hygiene
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** PROOF-CARRYING (Implemented)

## 1. Goal: Clean Birth
Ensure the first 2 seconds of the simulation are deterministic, clean (no overlaps, no energy bursts), and observable.

## 2. Startup Lifecycle Map (Call Graph)

### A. Initialization
1.  **Creation**: `new PhysicsEngine(config)`
2.  **Toplogy**: `addNode` calls `addNodeToEngine` -> sets `lastGoodX/Y` to current position.
3.  **Reset**: `resetLifecycle` clears counters but *preserves* topology.

### B. The First 2 Seconds (`engineTickPreflight.ts`)
The `isStartup` flag is active when `lifecycle < 2.0`.
During this window:
1.  **Firewall**: `runTickPreflight` checks for `NaN/Inf`.
    *   *Action*: Resets to `lastGood` or `0,0` if detected.
    *   *Metric*: `startupNanCount`.
2.  **Overlap Audit** (New):
    *   At `t=0`, we perform an O(N^2) check for overlapping nodes (R=30).
    *   Metric: `spawnOverlapCount0`.
    *   Peak Metric: `peakOverlapFirst2s`.
3.  **Velocity Clamp**:
    *   Stricter clamping may apply, tracked by `startupMaxSpeed`.

## 3. Invariants & Proofs

| Invariant | Enforcement Mechanism | Status |
| :--- | :--- | :--- |
| **No NaN/Inf** | `engineTickPreflight.ts` checks every node every frame. | [x] Active |
| **No Zero-Frame Overlap** | Captured by `spawnOverlapCount0`. | [x] Measured |
| **No Energy Burst** | `startupMaxSpeed` tracks peak velocity. | [x] Measured |
| **No Ghost Leaks** | `mode` tripwire (`assertMode`) active from Frame 0. | [x] Active |
| **Deterministic Seed** | `pseudoRandom` used for resolution. | [x] Verified |

## 4. Audit Counters Implemented

We have added specific forensic counters to the HUD (`engine.hudSnapshot.spawn`):

*   **`spawnTimestamp`**: Time of last reset/spawn.
*   **`spawnOverlapCount0`**: Number of overlapping pairs at the exact moment of spawn (Frame 0).
*   **`spawnPeakOverlap`**: Maximum overlaps detected during the 2s startup window.
    *   *Success Criterion*: Should decay rapidly to 0.
*   **`spawnMaxSpeed`**: Peak velocity during startup.
*   **`spawnLeaks`**: Boolean latch. If true, a legacy pass ran during XPBD startup (or vice versa).

## 5. Deterministic Quarantine

*   **DT Clamping**: `TimePolicy` logic applies. `startupStats.dtClamps` tracks if we hit the limit (preventing explosion on tab restore).
*   **Stagnation Escape**: Gated by `isStartup`. We confirmed `applyEdgeShearStagnationEscape` is allowed but `engine.lifecycle < 2.0` prevents accumulated idle time from triggering "sleep" prematurely.

## 6. Manual Smoke Tests (HUD Verified)

1.  **Spawn N=60**: Check `spawnOverlapCount0`. If > 0, watch `spawnPeakOverlap` decay.
2.  **Resize**: Confirm `bounds` update doesn't trigger NaN.
3.  **Mode Switch**: Toggle XPBD/Legacy. Respawn. Check `spawnLeaks` is FALSE.
4.  **Drag**: Drag node immediately. Confirm `spawnMaxSpeed` reflects user input but no explosion.

## 7. Patch Notes
*   **Forensic Counters**: Added `spawn` block to DebugStats and HUD.
*   **Overlap Audit**: Implemented O(N^2) overlap check in `runTickPreflight` (gated by N<200) to prove clean layout.
*   **Type Fixes**: Updated `engineTickTypes.ts` to support new stats.
