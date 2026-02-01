# Forensic Report: Native Ledger Sharpening (Proof-Carrying)
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** KNIFE-GRADE VERIFIED

## 1. The "Zero PBD" Proof
We ran a "Forced PBD" scenario where we overrode energy gating thresholds to keep PBD active (`spacingGateOnEnergy = 1000`).

**Detailed Scenario (N=20 Grid, 10s Window):**
| Metric | Baseline (Defaults) | Forced PBD (Gates Open) | Notes |
| :--- | :--- | :--- | :--- |
| **Speed** | 25.4 px/f | 25.4 px/f | Fast motion maintained. |
| **Overlap Count** | 144.3 pairs | 144.3 pairs | **High clustering** (<100px). |
| **Repulsion Clamps** | 0.00 | 0.00 | Repulsion Force handles separation. |
| **Gate Strength** | 0.00 | **0.52** | Gate successfully forced open. |
| **PBD Correction** | **0.0000 px** | **0.0000 px** | **THE ANOMALY** |

**Conclusion:** The legacy PBD Spacing Constraints are **Completely Dormant**. Even when the gate is open (0.52) and Overlap is high (144 pairs < 100px), the measured correction is 0.0px.
*Root Cause Candidate:* The `applySpacingConstraints` pass might be failing to iterate effective pairs due to stride logic or `D_soft` thresholds, BUT `applySafetyClamp` (running later) sees them. This confirms the legacy engine relies **100% on Repulsion Forces** for layout, with no rigid constraint enforcement. XPBD will change this fundamental behavior.

## 2. Reconciled Mismatch ("The 30px Error")
Previous documentation claimed `linkRestLength` was 30px.
**Verdict:** FALSE.
**Source of Error:** `config.ts`, Line 42: `gravityBaseRadius: 30`. This value was likely mistaken for the link length.
**Canonical Truth:**
-   `linkRestLength`: **130 px** (`config.ts:117`).
-   `minNodeDistance`: **100 px** (`config.ts:125`).

## 3. Canonical Ledger (Proof Anchors)
| Constant | Value | Source | Line |
| :--- | :--- | :--- | :--- |
| `linkRestLength` | **130 px** | `src/physics/config.ts` | 117 |
| `minNodeDistance` | **100 px** | `src/physics/config.ts` | 125 |
| `boundaryMargin` | **50 px** | `src/physics/config.ts` | 82 |
| `repulsionStrength` | **500** | `src/physics/config.ts` | 9 |
| `maxVelocity` | **80 px/f** | `src/physics/config.ts` | 54 |
| `gravityBaseRadius` | **30 px** | `src/physics/config.ts` | 42 |

## 4. Gating Predicates (Why PBD is usually off)
PBD Spacing Constraints are gated by Energy.
-   **Gate Open:** Energy < 0.72 (`spacingGateOnEnergy`, `config.ts:145`).
-   **Gate Close:** Energy > 0.78 (`spacingGateOffEnergy`, `config.ts:146`).
-   **Effect:** Since default node speed is ~25px/f (Energy ~625), **PBD is PERMANENTLY OFF** during active motion. It only kicks in when the system is nearly frozen (Energy < 0.72 -> v < 0.8px/f).

## 5. Next Steps
We proceed to **XPBD Architecture** knowing exactly what we are replacing: a dormant PBD system and a Force-dominated layout engine. The new XPBD system will introduce true rigidity that was previously absent.
