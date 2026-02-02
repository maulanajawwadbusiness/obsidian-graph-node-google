# Run 1: Deep Probe Installation (XPBD Damping)

**Date**: 2026-02-02
**Agent**: Antigravity

## Objective
Establish complete visibility into the `xpbdDamping` value lifecycle by installing "Value Probes" at three critical stages:
1.  **UI Level**: When the user clicks the preset button.
2.  **Config Level**: When the engine merges the new configuration.
3.  **Tick Level**: When the physics loop reads the value for integration.

## Changes
1.  **Modified `src/physics/engine.ts`**:
    -   Updated `applyXpbdDampingPreset` log to use `[XPBD-Probe]` prefix.
2.  **Modified `src/physics/engine/engineTopology.ts`**:
    -   Updated config merge log to use `[XPBD-Probe]` prefix.
3.  **Modified `src/physics/engine/engineTickXPBD.ts`**:
    -   Added a periodic (every 60 frames) and change-driven probe log associated with the `engine.uid`.

## Verification Plan
1.  Run the simulation.
2.  Click "Snappy", "Balanced", "Smooth".
3.  **Success**: Console should show a causal chain:
    -   `[XPBD-Probe] UI: Apply Preset ...`
    -   `[XPBD-Probe] Config Merge: Writing ...`
    -   `[XPBD-Probe] Tick: Read ...` (immediately following)
4.  **Failure**: Gaps in the chain indicate where the dataflow is broken.

## Next Steps
Proceed to Run 2 to fix any "disconnected update path" if the probes reveal a gap between UI/Merge and Tick.
