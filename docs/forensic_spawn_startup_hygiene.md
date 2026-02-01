# Forensic Report: Spawn & Startup Hygiene
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** PROOF-CARRYING (Sharpened)

## 1. Goal: Clean Birth
Ensure the first 2 seconds of the simulation are deterministic, clean (no overlaps, no energy bursts), and observable.

## 2. Startup Lifecycle Map (Call Graph)

### A. Initialization
1.  **Creation**: `new PhysicsEngine(config)`
2.  **Toplogy**: `addNode` calls `addNodeToEngine` -> sets `lastGoodX/Y` to current position.
3.  **Reset**: `resetLifecycle` clears counters but *preserves* topology.

### B. The First 2 Seconds (`engineTickPreflight.ts` & `engineTick.ts`)
The `isStartup` flag is active when `lifecycle < 2.0`.
During this window:

1.  **Firewall (Strict)**: `runTickPreflight`
    *   **Monitors**: `NaN/Inf`, `dtClamps`, `maxSpeed`.
    *   **Action**: If `dt` spike or `Speed > 2x Max` detected:
        *   Sets `strictClampActive = true`.
        *   **Hard Clamps** velocity to `maxVelocity`.
        *   **Resets** `prevX/prevY` ghost history to prevent rebound.
        *   Sustains for 5 ticks (`strictClampTicksLeft`).
    *   *Metric*: `strictClampActionAppliedCount`, `strictClampActive`.

2.  **Overlap Audit (Dual)**:
    *   At `t=0`, we perform an O(N^2) check.
    *   **R30**: Legacy visual radius (`overlapCount0`).
    *   **R100**: Physical shell (`overlapCount100`).
    *   *Peak Metric*: `spawnPeakOverlap30`, `spawnPeakOverlap100` (Captured at t=0, ensuring zero-frame violation visibility).

3.  **Deterministic Proof**:
    *   **Seed**: `pseudoRandom` seeded by Node IDs.
    *   **Order Hash**: `spawnOrderHash` checksums node ID sequence. (Change = nondeterministic input/sort).
    *   **Set Hash**: `spawnSetHash` (XOR sum). (Change = different set of nodes).
    *   *Metric*: `orderHashChanged` flags if reloads differ.

4.  **Motor Allow-List (Enforced)**:
    *   During `lifecycle < 2.0`, `engineTick.ts` **explicitly blocks**:
        *   `applyDenseCoreVelocityDeLocking` (Micro-Slip).
        *   `applyEdgeShearStagnationEscape`.
    *   *Justification*: Startup is high-energy; these motors are for stasis efficiency and introduce nondeterminism or "fake" motion.
    *   *Telemetry*: `microSlipDenied`, `escapeDenied`.

## 3. Invariants & Proofs

| Invariant | Enforcement Mechanism | Status |
| :--- | :--- | :--- |
| **No NaN/Inf** | `engineTickPreflight.ts` checks every node every frame. | [x] Active |
| **No Overlap Soup** | `overlapCount100` measures physical violations at t=0. | [x] Measured |
| **Determinism (Order)** | `spawnOrderHash` proves sequence identity. | [x] Proved |
| **Determinism (Set)** | `spawnSetHash` proves content identity. | [x] Proved |
| **No Energy Burst** | `startupMaxSpeed` tracks peak velocity. | [x] Measured |
| **Strict Action** | `strictClampActive` triggers actual velocity caps. | [x] Enforced |
| **Rest Motor Ban** | `engineTick.ts` gates calls with `lifecycle < 2.0`. | [x] Enforced |

## 4. Verification Checklist (HUD)
When verifying a fresh spawn:
1.  **Spawn**: Check `spawnOverlapCount100` is 0 (or low).
2.  **Re-Run**: Reload page/reset. Check `spawnOrderHash` is IDENTICAL.
3.  **Stress**: Tab-switch during load. Check `strictClampActive` flashes TRUE then OFF. Check `strictClampActionCount` increases.
4.  **Motors**: Check `microSlipDenied` increases during first 2s, then stops.

## 5. Patch Notes
*   **Sharpened Overlap**: Added R100/R30 dual audit.
*   **Strict Firewall**: Implemented actual velocity clamping logic, not just flags.
*   **Determinism**: Added Order/Set Hashes.
*   **Enforced Allow-List**: Added code-level blocking of rest motors during startup.
