# Forensic Report: Native Magnitude Ledger (Knife-Grade)
**Date:** 2026-02-01
**Status:** VALIDATED (Runtime)
**Conflicting Info:** Supersedes any prior docs claiming `linkRestLength=30`.

## 1. The Canonical Constants (Runtime Truth)
Any new XPBD constraint **MUST** use these base values to avoid explosion/implosion.

| Constant | Value | Source | Notes |
| :--- | :--- | :--- | :--- |
| **Link Rest Length** | `130 px` | `config.ts`, Runtime | Initial `dist` for springs. |
| **Min Node Distance** | `100 px` | `config.ts`, Runtime | Hard-shell diameter. |
| **Collision Padding** | `8 px` | `config.ts` | Extra buffer. |
| **Repulsion Strength** | `500` | `config.ts` | Soft force scale. |
| **Max Velocity** | `80 px/frame` | `config.ts` | Hard cap (~4800 px/s). |

**Modifiers:**
- `targetSpacing` (alias for `linkRestLength`): `130 px`.
- `lengthBias`: Random modifier `0.8 - 1.2` per link (if enabled).

## 2. Measured Runtime Dynamics (N=20, T=5s)
*Measured via `scripts/forensic_harness.ts`.*

| Metric | Typical Avg | Max Peak | Visibility |
| :--- | :--- | :--- | :--- |
| **Speed (v)** | `~20 px/frame` | `~90 px/frame` | **Fast**. Motion is dominant. |
| **Overlap Count** | `~30` pairs | `~70` pairs | **High**. Dense clustering. |
| **PBD Correction** | `0.0 px`* | `0.0 px`* | **Dormant**. |
| **Repulsion Clamps**| `0.0` | `0.0` | **Force Dominant**. |

***Critical Finding (Zero PBD):** despite high Overlap Counts (avg 33 pairs colliding), the legacy PBD solvers (`spacingConstraints` / `safetyClamp`) are **applying 0 correction**. This implies the legacy engine relies entirely on `Repulsion Force` to separate nodes over time, or the PBD gating (penetration > 5px) fails to catch the fast-moving nodes before forces do.
**Conclusion:** The legacy "hard shell" is actually a "force field". XPBD will introduce a *true* hard shell, which will feel significantly stiffer.

## 3. Visibility Thresholds (Renderer Grounded)
Calibrated to standard 1080p viewport (Zoom=1.0).

| Magnitude | Visual Effect | XPBD Tuning |
| :--- | :--- | :--- |
| **< 0.1 px** | Invisible | Acceptable residual error. |
| **0.5 px** | "Shimmer" | Target max error for stable stack. |
| **2.0 px** | "Drift" | Visible motion. |
| **> 5.0 px** | "Jump" | Distracting. Limit projection per frame. |
| **Speed > 10** | "Fast" | 600 px/s. Needs motion blur or high framerate. |

## 4. XPBD Integration Targets
To match the "Native Scale" without breaking the simulation:

1.  **DistanceConstraint**:
    -   Rest Length: `130 px`.
    -   Stiffness: Low (`alpha ~ 0.005`) to match the "Force Field" feel, or High (`alpha=0`) if we want to snap. Recommendation: Start soft.

2.  **ContactConstraint**:
    -   Radius: `100 px` (MinNodeDist).
    -   Stiffness: `alpha = 0` (Hard) or `alpha = 0.001` (Rubber).
    -   **Important**: Since legacy PBD was dormant, adding active Hard Contacts will change the feel from "Mushy" to "Solid".

3.  **Solver Steps**:
    -   Start with `1` substep (Legacy Budget).
    -   If "Shimmer" > 0.5px, increase to `2`.
