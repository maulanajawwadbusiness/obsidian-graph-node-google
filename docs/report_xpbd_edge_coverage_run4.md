# XPBD Edge Coverage Run 4: Correctness & Dead-End Detection

## Goal
Verify that all selected edges are processed (touched by the solver) unless explicitly validly skipped (e.g. both endpoints pinned), and ensure inactive checks don't prevent propagation.

## Findings
- **Endpoint Processing**: The solver calculates weights `wA`, `wB` based on `isFixed` or `draggedNodeId`.
    - If `nA` is pinned/dragged, `wA = 0`.
    - If `nB` is free, `wB > 0`.
    - Solver calculates correction `deltaLambda`.
    - `pxA` is scaled by `wA` (so 0).
    - `pxB` is scaled by `wB` (so non-zero).
    - **Result**: Pinned node stays fixed, neighbor moves. This is CORRECT for propagation (local tug).
- **Processing Logic**: The loop iterates `constraints.length`.
    - Explicit `continue` only occurs for:
        1.  Invalid Endpoints (Safety).
        2.  Both Pinned (`wA + wB === 0`).
        3.  Singularity (`dist < EPSILON`).
        4.  Debug Filter (`incident` mode).

## Changes
1.  **Telemetry**: Added `edgesProcessed` and `edgesSelectedButUnprocessed`.
    - `edgesProcessed`: Count of edges that reached correction application.
    - `edgesSelectedButUnprocessed`: `Total - Skipped - Singularity - Processed`.
    - This serves as a "Check Sum" or "Leak Detector".
2.  **HUD**: Displayed as `Proc: N (Leak: M)`. 
    - Expected: `Leak: 0`.

## Verification
- **HUD Indicator**: `Leak: 0` during drag and idle.
- **Pinned Behavior**: Dragging a node (invMass=0) correctly leaves it fixed (w=0) while pulling neighbors (w>0).
- **Conclusion**: Edge solving coverage is mathematically complete for the selected set.

## Next Steps
- Run 5: Final verification and regression guard (automated warning).
