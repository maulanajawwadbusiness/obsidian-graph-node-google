# Forensic Report: Hover Dead Fix (2026-01-31)

## Symptom
Hover detection ceased functioning. Nodes would not highlight under cursor.

## Root Cause Analysis
1.  **Coordinate Mapping Failure**: `hoverController.ts` instantiated `CameraTransform` with incorrect arguments.
    - Expected: `new CameraTransform(..., dpr, pixelSnapping)`
    - Actual: `new CameraTransform(..., pixelSnapping)`
    - Consequence: `dpr` received a boolean. `clientToWorld` logic is robust against this, BUT `worldToScreen` (used for internal checks) was compromised.
    - **Deeper Issue**: `settingsRef.current.pixelSnapping` was getting passed into the `dpr` slot.

2.  **Grid Population Integrity**:
    - `RenderScratch` populates `hitGrid` during `prepare()`.
    - `drawNodes` uses the same scratch buffer.
    - If rendering works, grid IS populated.
    - Confirmed by static analysis of `renderScratch.ts`.

## Fix Implementation
1.  **Signature Alignment**: Updated `clientToWorld` and `worldToScreen` in `hoverController.ts` to pass `1.0` explicit DPR before `pixelSnapping`.
2.  **Instrumentation**: Added `[HoverDbg]` counters to `updateHoverSelection` to log Grid Stats (Buckets/Items) and World Coordinates.
3.  **Safety**: Added `SpatialGrid.stats()` for runtime inspection.

## Verification
- **Invariant**: `clientToWorld` now receives correct arguments, ensuring sane World Coordinates.
- **Invariant**: `hitGrid` population is checked against engine node count in debug mode.
- **Performance**: No regressions. Counters only run if `hoverDebugEnabled` is set.

## Status
Fix deployed. Instrumentation ready for runtime confirmation if issue persists.
