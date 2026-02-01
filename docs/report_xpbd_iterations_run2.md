# XPBD Iteration Budget Run 2: Config Knobs & Plumbing

## Goal
Introduce iteration configuration and selection logic, while maintaining current single-pass behavior.

## Changes
1.  **Config**: Added `xpbdIterationsIdle` and `xpbdIterationsDrag` to `ForceConfig` (Default: 1).
2.  **Selection Logic**: `engineTickXPBD.ts` now calculates `iterCount = draggedNodePinned ? iterDrag : iterIdle`.
3.  **Telemetry**:
    - `xpbdFrameAccum.springs.iter` now accumulates `iterCount`.
    - HUD displays configured vs used: `iter: Used (cfg: Idle/Drag)`.
4.  **Behavior**: Still runs the solver loop exactly once (but logic is prepped for Run 3).

## Verification
- **HUD**: Shows `iter: 1 (cfg: 1/1)` by default.
- **Drag State**: Since defaults are 1/1, it stays 1.

## Next Steps
- Run 3: Multi-Iteration Loop Implementation (defaults 2/6).
