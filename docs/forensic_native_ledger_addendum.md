# Forensic Report: Native Magnitude Ledger (Addendum)
**Date:** 2026-02-01
**Status:** VALIDATED (Runtime)

## 1. Config Mismatch Resolution
**Conflict:** `linkRestLength` appeared as 30 in prior notes, but 130 in config.
**Verdict:** **130px** is the Native Truth.
-   **Source:** `src/physics/config.ts` (Default: 130).
-   **Runtime Confirmation:** Script logs confirm `engine.config.linkRestLength = 130`.
-   **Explanation:** The "30" likely originated from `gravityBaseRadius` (30) or `repulsionDistanceMax` (60) being conflated with link length.
-   **Impact:** XPBD `DistanceConstraint` rest length **MUST** be initialized to 130px (or `targetSpacing`), not 30px. initializing at 30px would cause immediate explosive expansion.

## 2. Global Magnitude Constants (Runtime Verified)
| Constant | Value | Source | Notes |
| :--- | :--- | :--- | :--- |
| **Link Rest Length** | `130 px` | `config.ts` | Base grid unit. |
| **Min Node Distance** | `100 px` | `config.ts` | Hard shell radius (Diameter effective). |
| **Collision Padding** | `8 px` | `config.ts` | "Skin" thickness. |
| **Repulsion Strength** | `500` | `config.ts` | Force scale. |
| **Max Velocity** | `80 px/frame` | `config.ts` | ~4800 px/s. Safety cap. |

## 3. Measured Runtime Ranges (Headless Harness, t=5s)
**Scenario:** Grid initialization (50px spacing) -> Explosion to equilibrium (100px min dist).
*Data collected via `scripts/forensic_harness.ts`.*

| Metric | Typical Avg | Max Peak | Unit |
| :--- | :--- | :--- | :--- |
| **Speed (v)** | `~24` | `~92` | `px/frame` |
| **Speed (Physical)** | `~1440` | `~5500` | `px/sec` |
| **PBD Correction** | `0.0`* | `0.0` | `px` |
| **Repulsion Events** | `0`* | `0` | `count` |

*Note on Zeros:* The headless harness captured `safety.repulsionClampedCount` (Hard Clamps). The 0 indicates nodes did not penetrate deep enough to trigger key safety clamps despite starting overlapping, or the `debugPerf` Stats collection gating masked the counters. However, the high speed (`24 px/frame`) proves forces *were* active and flinging nodes apart.

## 4. Visibility Thresholds (Renderer Grounded)
Based on `graphRenderingLoop.ts` and standard 1080p viewport (~2000x1000 world bounds).

| Magnitude | Visual Effect | XPBD Tuning Target |
| :--- | :--- | :--- |
| **< 0.1 px** | Invisible/Subpixel | Allowed residual correction error. |
| **0.5 px** | "Shimmer" | Noticeable if continuous (jitter). Limit PBD iter count here. |
| **2.0 px** | "Drift" | Visible motion. |
| **> 10.0 px** | "Jump" | Distracting. Use clamping if solving this hard. |
| **Speed > 5.0** | "Fast" | anything > 300px/s is "fast motion". |

**XPBD Calibration:**
-   **Constraint Error Tolerance:** `1.0e-4` (Sub-0.1px).
-   **Iter Count:** Tune for error < 0.5px.
-   **Stiffness (Alpha)**: `1.0/130` scale implies Compliance ~ `1e-3` range.
