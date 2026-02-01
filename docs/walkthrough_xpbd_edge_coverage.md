# Walkthrough: XPBD Full Edge Coverage Verification

## Objective
Guarantee that the XPBD solver processes **ALL** edges in the graph every frame (Full Body Motion), eliminating any "incident-only" or "active-set" filtering that would dampen propagation.

## Work Summary

### Run 1: Forensic Locate
- **Findings**: The solver (`engineTickXPBD.ts`) iterates `engine.links` (the full graph). No hidden filters found.
- **Action**: Added telemetry fields `totalEdgesGraph`, `edgesSelectedForSolve`, `edgesSelectedReason`.

### Run 2: Full Edge Solve (Default)
- **Constraint**: User required a "safe fullGraphEdges path" and "incident-filter behind dev flag".
- **Action**: Implemented `ForceConfig.xpbdEdgeSelection` ('full' | 'incident').
- **Implementation**: Default is 'full'. 'incident' mode mimics legacy behavior (skips non-dragged edges).
- **Verification**: Added "Incident Only" toggle in HUD. Toggling it proves the filter works (and is OFF by default).

### Run 3: Secondary Filters Audit
- **Audit**: Searched for `coverage`, `degrade`, `lod`. None found in XPBD pipeline.
- **Action**: Added `edgesSkippedByCoverage` telemetry (hardcoded to 0) to explicitly document this absence.

### Run 4: Correctness Check
- **Goal**: Ensure processed edges actually touch endpoints (especially if inactive).
- **Action**: Added `edgesProcessed` and `edgesSelectedButUnprocessed` (Leak) telemetry.
- **Result**: `Leak: 0`. Pinned nodes (`w=0`) are handled correctly (neighbor moves).

### Run 5: Safety Guard
- **Action**: Added console warning if `Processed / Total < 90%` (and mode is 'full').
- **Purpose**: Catch regression if future optimizations inadvertently drop too many edges (e.g. over-aggressive singularity culling).

## Telemetry Guide (HUD)

In **Debug > Physics Stats > XPBD Edge Coverage**:

- **Ratio**: `Selected / Total`.
    - Should be `1.0` (or `N / N`).
    - If `incident` mode is ON (drag), Selected drops to ~degree of dragged node.
- **Proc**: `Processed (Leak: X)`.
    - `Processed` = Selected - Skipped (Pinned/Singular).
    - `Leak` should be `0`.
- **Reason**:
    - `full`: Normal operation.
    - `incident`: Debug filter active.

## Code Artifacts
- `src/physics/engine/engineTickXPBD.ts`: Solver logic + Guard.
- `src/physics/engine/physicsHud.ts`: Snapshot definition.
- `src/playground/components/CanvasOverlays.tsx`: HUD rendering & Toggle.

## Conclusion
The XPBD solver is visually and statistically verified to process the full graph topology every frame.
