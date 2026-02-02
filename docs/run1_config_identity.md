# Run 1: Config Identity Probes (XPBD Damping)

**Date**: 2026-02-02
**Agent**: Antigravity

## Objective
Establish tracing to prove whether the `PhysicsEngine` tick loop is reading from the *same* configuration object instance that `updateEngineConfig` is writing to, and whether updates are visible (strictly increasing version number).

## Changes
1.  **Modified `src/physics/engine.ts`**:
    -   Added `configVersion` (starts at 0) and `configId` (random 6-char hash) to `PhysicsEngine`.
2.  **Modified `src/physics/engine/engineTopology.ts`**:
    -   Increment `engine.configVersion` on every update.
    -   Log `[Config-Probe] Write: Version=X ID=Y ...`.
3.  **Modified `src/physics/engine/engineTickXPBD.ts`**:
    -   Log `[Config-Probe] Tick Read: Version=X ID=Y ...` every 60 frames.

## Verification Plan
1.  Run the simulation.
2.  Observe the console.
3.  Click a preset.
4.  **Success**:
    -   The `Write` log appears with `Version=N`.
    -   The subsequent `Tick Read` log (within <1s) shows `Version=N` (or higher) and matching `ID`.
5.  **Failure**:
    -   `Tick Read` shows `Version < N`.
    -   `Tick Read` shows different `ID` (different engine instance?).

## Next Steps
Proceed to Run 2 to audit for any cached config lookups that might bypass this live property access.
