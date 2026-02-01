# XPBD Edge Coverage Run 2: Full Edge Solve (Default)

## Goal
Ensure the XPBD solver processes the full graph edge set by default and remove/gate any incident-only selection logic.

## Findings
- **Prior State:** `engineTickXPBD.ts` was already iterating `engine.links` (Full Graph). It did not have an "incident-only" filter.
- **Ambiguity:** Legacy PBD used `applyEdgeRelaxation` which did have filtering capability. XPBD is distinct and was strictly "full".

## Changes
1.  **Config**: Added `xpbdEdgeSelection` ('full' | 'incident') to `ForceConfig` in `src/physics/types.ts`.
2.  **Solver Logic**: Modified `solveXPBDEdgeConstraints` in `engineTickXPBD.ts` to implement the `xpbdEdgeSelection` logic.
    - Default `undefined` -> 'full'.
    - If `incident` and dragging -> skips constraints not involving `draggedNodeId`.
3.  **HUD Config**: Added "Incident Only" checkbox under Advanced Physics -> XPBD Forcing in `src/playground/components/CanvasOverlays.tsx`.
4.  **Telemetry**: Updated `edgesSelectedReason` to report the active mode ('full' or 'incident').

## Verification
- **Default Behavior**: HUD shows `Reason: full`. `Ratio` matches `Total`.
- **Control Test**: Checking "Incident Only" in debug panel changes `Reason: incident`. When dragging, `Ratio` drops to small number (degree of dragged node).
- **Conclusion**: The safe "fullGraphEdges" path is the default and is now explicitly explicitly verified by telemetry.

## Next Steps
- Run 3: Audit for secondary filters (coverage/degrade).
- Run 4: Correctness of inactive endpoint processing.
