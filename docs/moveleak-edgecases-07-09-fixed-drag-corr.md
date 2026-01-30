# Physics Move Leak Fixes (Phase 3): Authority & Cleanup
**Fixes #7, #8, #9**
**Date:** 2026-01-30

## 1. Problem Statement
The "Real Move Leak" persisted in edge cases where nodes drifted despite correct render mapping.
*   **Fix 7 (Fixed Authority)**: Fixed nodes dragged by diffusion or failing constraint checks.
*   **Fix 8 (Stale Drag)**: Release left "ghost forces" (leash) or momentum (slingshot).
*   **Fix 9 (Correction Creep)**: Per-tick correction accumulators leaked residue into the next frame.

## 2. Implementation Details

### Fix 7: Absolute Fixed Authority
*   **Correction Gates**: Modified `applyCorrectionsWithDiffusion` (in `corrections.ts`) to explicit check `isFixed` before diffusing forces *to* a neighbor.
*   **Leak Watchdog**: Added a snapshot mechanism in `PhysicsEngine.tick`. If a fixed node moves > 0.0001px during a tick, it logs `[FixedLeakWarn]` and forcibly resets the position to the snapshot.

### Fix 8: Drastic Drag Cleanup
*   **Aggressive Release**: In `releaseNode` (engine.ts):
    *   Velocity is clamped by 90% (`vx *= 0.1`) to kill slingshot momentum.
    *   `prevFx`, `prevFy` (force memory) are effectively cleared to prevent "lagged" forces from continuing to push.
    *   `lastCorrectionDir` is deleted to reset directional inertia.
    *   `dragTarget` is explicitly nullified.

### Fix 9: Correction Accumulator Reset
*   **Lifecycle Management**:
    *   Added an explicit `correctionAccumCache` zeroing loop at the **end** of `PhysicsEngine.tick`.
    *   Updated `constraints.ts` initialization to be redundant-safe (zeroes even if valid).
*   **Prevents**: "Creep" where a 0.001px correction delta survives to the next frame and biases the solver.

## 3. Verification
1.  **Fixed Node Stability**:
    *   Enable "Debug Perf". Drag a node (making it fixed).
    *   Watch logs. No `[FixedLeakWarn]` should appear even during heavy collisions/explosions.
2.  **Drag Release**:
    *   Drag a node fast and release. It should "stop dead" or drift very slightly, not fly off or rubber-band back.
3.  **Idle Drift**:
    *   Let graph settle. Enable `Pixel Snapping`. The graph should be mathematically static (no sub-pixel creep).

## 4. Files Modified
*   `src/physics/engine.ts`: Release logic, Tick cleanup, Leak detection.
*   `src/physics/engine/constraints.ts`: Accumulator zeroing.
*   `src/physics/engine/corrections.ts`: Diffusion gating.
