# Forensic Report: Ledger Sharpening
**Date:** 2026-02-01
**Executor:** Antigravity

## 1. Conflict Resolution
**Issue:** Previous docs stated `linkRestLength = 30px`. Config code and Runtime Harness proved `linkRestLength = 130px`.
**Resolution:** `30px` was likely conflated with `gravityBaseRadius`. The document `docs/forensic_native_ledger.md` has been overwritten with the valid 130px truth.

## 2. Measurement Corrections
**Issue:** Initial harness showed 0 corrections/repulsion.
**Action:**
-   Repaired `stats.ts` to expose `penetrationCount` and `correctionMax`.
-   Updated harness to capture granular PBD stats.
-   Ran 3 scenarios (N=5, 20, 60).

**Findings:**
-   **Overlap is High**: ~30-170 pairs overlapping.
-   **Correction is Zero**: The legacy PBD systems are largely ineffective or dormant in the default config, likely due to hysteresis gating (penetration > 5px) or Force Repulsion resolving issues loosely before PBD sees them.
-   **Implication**: XPBD will be the first time constraint enforcement is *actually* rigid. Expect visual changes (stiffening).

## 3. Deliverables
-   **Proprietary Truth**: `docs/forensic_native_ledger.md` is now trusted.
-   **Harness**: `scripts/forensic_harness.ts` is robust.

We are clear to proceed with Repulsion/XPBD architecture.
