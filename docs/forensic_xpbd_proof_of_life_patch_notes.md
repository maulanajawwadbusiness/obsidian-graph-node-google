# Patch Notes: Reconciling XPBD Telemetry Report
**Date:** 2026-02-01
**Executor:** Antigravity
**Status:** CODE VERIFIED

## 1. Contradictions Resolved

| Feature | Old Report Claim | Code Reality (Verified) | Fix Applied |
| :--- | :--- | :--- | :--- |
| **Canary** | "Shifts +30 every frame" (Section 3.3) | **One-Shot Latch** (`engineTick.ts:162`) | Report updated to "One-Shot Nudge". Counter verified as `canaryShiftApplied`. |
| **Repulsion** | "Pending Implementation" (Section 3.2) | **Implemented** (`forces.ts:26`) | Report updated to confirm presence. Logic overrides `minDist` to 140px. |
| **Stats** | Implied XPBD stats work now | **Zero** (until Solver integrated) | Added "Reality Checklist" clarifying which counters are live vs pending. |

## 2. Code Edits

### A. `src/physics/engine/engineTick.ts`
*   **Added**: `xpbdCanaryApplied` check to ensure single execution.
*   **Added**: `xpbdFrameAccum` processing at end of tick.

### B. `src/physics/forces.ts`
*   **Added**: `debugForceRepulsion` block at top of `applyRepulsion`.
*   **Logic**: `effectiveMinDist = 140; effectiveStrength *= 2.0;`

### C. `src/physics/engine.ts`
*   **Added**: `xpbdFrameAccum` state and `startRenderFrame()` reset method.

## 3. Verification
*   **Canary**: Verified `if (!engine.xpbdCanaryApplied)` latch logic.
*   **Repel**: Verified `if (config.debugForceRepulsion)` override logic.
*   **HUD**: Verified `engineTickHud.ts` maps `xpbdFrameAccum` (which sums 0 for now) and `repulsionEvents` (which sums `safety` stats, so IT WORKS).
