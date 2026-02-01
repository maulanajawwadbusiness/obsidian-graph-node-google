# XPBD Edge Coverage Run 3: Secondary Filters Audit

## Goal
Audit for any second-stage filters (degrade, coverage, active-set) that might shrink the edge selection after the initial list build.

## Findings
- **Search**: Grepped `engineTickXPBD.ts` for terms: `coverage`, `degrade`, `stride`, `lod`, `mask`.
- **Result**: No hits in the XPBD logic.
- **Comparison**: `engineTick.ts` (Legacy) uses `spacingStride` and `pairBudgetScale`, but these variables are not passed to or used by `solveXPBDEdgeConstraints`.

## Changes
1.  **Telemetry**: Added `edgesSkippedByCoverage` to `xpbdFrameAccum` in `engineTickTypes.ts` and HUD.
2.  **Implementation**: Explicitly set `edgesSkippedByCoverage = 0` in `engineTickXPBD.ts` to document the absence of filtering.
3.  **HUD**: Debug display now includes this metric (though hidden in deep debug or inferred from Total==Selected).

## Verification
- **HUD**: Shows `skipped: 0` (or `Total == Solved` implied).
- **Conclusion**: The XPBD pipeline currently has zero secondary filtering. All selected edges are processed.

## Next Steps
- Run 4: Correctness (Process Inactive Endpoints).
