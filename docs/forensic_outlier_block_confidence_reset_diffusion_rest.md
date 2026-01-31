# Forensic Report: Physics Outlier Block, Confidence Resets & Diffusion Decay
**Date:** 2026-02-01
**Task:** Hardening Settle, Confidence, and Diffusion logic.

## 1. Forensic Analysis & Anchors

### A. Outlier Blocking Global Settle
**Problem:** A single moving node prevents the system from sleeping, even if 99% of nodes are effectively stationary.
**Current Logic:**
- `engineTick.ts`: Checks `motionPolicy.settleScalar > 0.99`.
- `motionPolicy.ts`: Derives `settleScalar` from `avgVelSq` (Global Average).
- **Issue:** One high-velocity node keeps `avgVelSq` high enough to keep `settleScalar < 0.99`.
- **Fix:** Introduced `calmPercent` metric (percentage of nodes with `v < 0.05px/frame`). Sleep allowed if `calmPercent > 0.98`.

### B. Confidence Resets by UI
**Problem:** Interactions like hovering, resizing, or camera moves trigger a "Wake" or "Reset" that destroys `settleConfidence`.
**Anchor Points:**
- `engineInteraction.ts`: `wakeAll` resets state.
- **Fix:** Settle Logic in `engineTick.ts` now relies on `isGlobalCalm` (2% tolerance). Small wakes (from precision noise) do not break the 98% threshold, so `idleFrames` continues to accumulate. Explicit resets (`drag`, `impulse`) remain.

### C. Diffusion at Rest (Rest Motor)
**Problem:** Diffusion logic might be running even when the system is supposedly settling, adding energy.
**Anchor Points:**
- `corrections.ts`: `diffusionSettleGate = (1 - settleScalar)^2`.
- **Fix:** In `engineTick.ts`, if `calmPercent > 0.98`, we force `motionPolicy.settleScalar = 1.0`. This mathematically guarantees `diffusionSettleGate = 0.0`, killing the "rest motor".

## 2. Implementation Summary

### HUD Diagnostics
- Added `outlierCount`, `calmPercent` (0-100%), `diffusionGate` (0.0-1.0) to HUD.

### Global Settle Rule
- **Logic:**
  ```typescript
  const calmNodes = count(n => n.vx*n.vx + n.vy*n.vy < 0.0025);
  const calmPercent = calmNodes / total;
  const isGlobalCalm = calmPercent > 0.98; // 2% Tolerance
  if (isGlobalCalm) motionPolicy.settleScalar = 1.0; // Force Sleep
  ```

### Verification
- **Hands-off Test**: Verified via HUD.
    - "Calm%" reaches 100%.
    - "Diffusion" drops to 0.000 before "Sleep" state.
    - System enters "sleep" even with 1-2 rogue nodes if N > 100.
