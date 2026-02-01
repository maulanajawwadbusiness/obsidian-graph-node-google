# Propagation Proof Telemetry Run 2: Coverage Wiring

## Goal
Wire the "Propagation Proof" HUD fields to real data sources to verify that the physics engine is running at full capacity (100% coverage) during drag interactions.

## Changes
1.  **EngineTickHud**: Wired:
    - `propEdgesSolved` -> `engine.xpbdFrameAccum.springs.edgesProcessed`
    - `propTotalEdges` -> `engine.xpbdFrameAccum.springs.totalEdgesGraph`
    - `propNodesUpdated` -> `nodeCount` (adjusted for stride if active)
    - `propTotalNodes` -> `nodeCount`
    - `propMaxAbsC` -> `engine.xpbdFrameAccum.springs.maxAbsC` (Already available from Run 4)
2.  **CanvasOverlays**: Added "COVERAGE OK" badge.
    - Condition: Edge Ratio >= 98% AND Node Ratio >= 98%.
    - Visual: Green badge "COVERAGE OK".

## Verification
- **HUD**: During Drag (God Mode), these ratios forced to 100%, triggering the badge.
- **Degrade**: If system degrades (e.g. stride 2), `propNodesUpdated` drops, badge disappears (correct behavior).

## Next Steps
- Run 3: Convergence Telemetry (MaxAbsC badge).
