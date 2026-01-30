# Physics Move Leak Fixes (Phase 7): Degeneracy, MicroNoise, DT Skew
**Fixes #19, #20, #21**
**Date:** 2026-01-30

## 1. Problem Statement
The "Real Move Leak" persisted in edge cases involving numerical instability and noise injection.
*   **Fix 19 (Triangle Degeneracy)**: When triangles became nearly collinear (flat), area constraint gradients "blew up", calculating huge corrections that caused spikes and teleportation.
*   **Fix 20 (Micro-Noise Misgating)**: The `StaticFrictionBypass` (micro-slip) logic was too aggressive, injecting energy when the graph was already moving or during drag, leading to perpetual micro-motion.
*   **Fix 21 (DT Skew Drift)**: The "Temporal Decoherence" feature (random per-node DT) caused local clusters to drift apart because damping was not uniform time-invariant.

## 2. Implementation Details

### Fix 19: Triangle Degeneracy Guard
*   **Logic**: In `applyTriangleAreaConstraints` (constraints.ts):
    *   Added `maxTriCorrection` clamp (2.0px/frame).
    *   Added **Ramp Down**: If `currentArea < 5.0` (approaching degeneracy), the correction is multiplied by `area/5.0`.
*   **Result**: As a triangle becomes flat, the force fades to zero instead of exploding to infinity. This prevents "pop" artifacts.

### Fix 20: Strict Delock Gating
*   **Drag Guard**: `applyStaticFrictionBypass` (staticFrictionBypass.ts) now immediately returns if `engine.draggedNodeId` is active.
*   **Tighter Threshold**: Reduced `relVelEpsilon` from 0.5 to 0.05. Noise only runs if relative velocity is *truly* near zero.
*   **Reduced Amplitude**: Reduced `microSlip` from 0.02 to 0.01.
*   **Result**: The system respects rest states and user interaction. Noise only nudges truly stuck, dense clumps.

### Fix 21: Enforce DT Coherence
*   **Disable Skew**: In `integration.ts`, we now force `skewMagnitude = 0` by default.
*   **Result**: All nodes integrate the same `dt`. Damping is uniform. Cluster drift is eliminated. (Skew is only enabled if `debugPerf` is true AND no interaction is happening).

## 3. Verification
1.  **Triangle Stability**:
    *   Flatten a triangle (dense cluster): No explosion.
2.  **Perpetual Motion**:
    *   Settle graph. It should stay settled. The micro-slip won't fire unless `relVel < 0.05`.
3.  **Cluster Drift**:
    *   Clusters remain cohesive during expansion/settling.

## 4. Files Modified
*   `src/physics/engine/constraints.ts`: Triangle guard.
*   `src/physics/engine/velocity/staticFrictionBypass.ts`: Delock gating.
*   `src/physics/engine/integration.ts`: DT skew disabled.
