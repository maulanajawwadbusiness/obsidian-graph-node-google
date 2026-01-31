# Comprehensive Physics Hardening Report
**Date:** 2026-02-01
**Focus:** Visual Dignity, Cross-Browser Determinism, and Numeric Robustness.

## 1. Executive Summary
This sprint hardened the physics engine against "near-miss" numeric catastrophes, micro-jitter, and cross-browser drift. The system is now bit-exact reproducible (deterministic) on reset and self-corrects against floating point accumulation.

## 2. Key Hardening Measures

### A. The "Visual Dignity" Gate (Diffusion Hardening)
**Problem:** Diffusion logic was "popping" (on/off) at specific pressure thresholds, causing visual flutter.
**Solution:**
-   **Continuous Gating**: Replaced binary `> 0.01` checks with a smoothstep curve (`t*t*(3-2t)`) mapping `0.1` -> `0.3` magnitude.
-   **Effect**: Diffusion strength fades in/out organically, preventing sudden velocity changes.

### B. Determinism & Stability
**Problem:** `Set` iteration order varies by insertion history. Physics sums ($A+B+C$) differed depending on user interaction history, breaking determinism and creating variable "butterfly effects".
**Solution:**
-   **Stable Iteration**: Explicitly sorted `hotPairs` keys and ensured neighbor loops use stable array indices.
-   **Checksum HUD**: Added `chk: [HEX]` to HUD. Hashes node positions to `0.001` precision. Green = Sync, Red = Drift.
-   **Verified**: Chrome and Firefox now produce identical layouts for identical inputs.

### C. The "Anti-Drift" Rebase
**Problem:** Long-running simulations accumulate microscopic floating point errors ("ghost energy"), preventing true sleep.
**Solution:**
-   **Local Rebase**: When a node is calm (`conf > 0.95`) and barely moving (`v < 1e-5`), we snap `v` and `pos-prevPos` to exactly `0.0`.
-   **Global Rebase**: If the graph drifts too far from origin (`> 50,000` units), we shift the entire coordinate system back to centroid (0,0) to preserve float precision.

### D. Outlier Blocking
**Problem:** Single "teleporting" nodes (from bad interaction or layout) could inject massive energy into the system.
**Solution:**
-   **Velocity Clamp**: Hard cap on `maxVelocity` per frame.
-   **State Flip Detect**: If a node flips direction (`v` vs `prevV`) repeatedly at high speed, it is flagged as an outlier and its interaction weight is reduced.

## 3. Updated System Architecture

### New Modules / Logic
-   **`src/physics/engine/stats.ts`**: Added `determinismChecksum`, `rebaseCount`.
-   **`src/physics/engine/engineTick.ts`**: Implemented the Rebase and Checksum logic.
-   **`src/physics/engine/constraints.ts`**: Implemented sorted iteration for `hotPairs`.

### Documentation Updates
-   `docs/physics_xray.md`: Updated to include "Determinism & Rebase" strategy.
-   `docs/system.md`: Updated "Physics Authority" section.

## 4. Work Left / Next Steps
-   **Numeric Firewall**: Implementation of centralized `safeNormalize` and `epsilon` constants (Planned in `forensic_numeric_robustness_near_miss.md` but not fully engaged).
-   **Unit Tests**: Add Jest snapshot tests for specific physics scenarios using the new deterministic behavior.
