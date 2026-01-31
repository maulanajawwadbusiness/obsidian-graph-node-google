# Forensic Report: Diffusion Hardening & Ghost Velocity Fix
**Date:** 2026-02-01
**Task:** Ensure diffusion decays at rest and does not inject ghost velocity.

## 1. Forensic Analysis & Anchors

### A. Diffusion "Rest Motor"
**Problem:** Diffusion continues to run even when trying to sleep, or fails to decay smoothly.
**Behavior:** Previously, `settleConfidence` only jumped to 1.0 when `calmPercent > 0.98`. Since diffusion relies on `(1 - settle)^2`, it remained active at partial strength until the final snap.
**Fix:** Implemented **Smooth Diffusion Decay**.
-   Inside `engineTick.ts`, `settleScalar` now blends linearly from current value to 1.0 as `calmPercent` moves from 50% to 98%.
-   Result: Diffusion force fades to 0.0 *before* the physics loop cuts off, preventing "motor at rest" vibration.

### B. Ghost Velocity Injection
**Problem:** Diffusion moves `pos` but fails to update `prevPos`, effectively creating velocity (`v = (pos - prevPos)/dt`).
**Fix:** Reinforced Reconciliation Logic.
-   In `corrections.ts`: Added explicit `node.prevX += dx` whenever `node.x += dx` is called during diffusion.
-   Added **Ghost Mismatch HUD**: Tracks any disparity between `posDelta` and `prevPosDelta`. If `> 0`, it means velocity was accidentally created.

## 2. Implementation Summary

### HUD Diagnostics
-   `diffusionStrengthNow`: Shows the effective diffusion multiplier (0.0 - 1.0).
-   `ghostMismatchCount`: Counts nodes where reconciliation failed (should be 0).

### Physics Hardening
-   **File**: `src/physics/engine/engineTick.ts`
    ```typescript
    if (calmPercent > 0.5) {
        const t = smoothstep(0.5, 0.98, calmPercent); // 0..1
        motionPolicy.settleScalar = Math.max(motionPolicy.settleScalar, t);
    }
    ```
-   **File**: `src/physics/engine/corrections.ts`
    ```typescript
    node.x += dx;
    if (node.prevX) node.prevX += dx; // Velocity preserved (v=v)
    ```

### Verification
-   **Hands-off Test**: Verified via HUD.
    -   `diffusionStrengthNow` drops to 0.00 as calm rises.
    -   `ghostMismatchCount` stays at 0.
