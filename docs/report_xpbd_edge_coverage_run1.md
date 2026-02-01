# XPBD Edge Coverage Run 1: Forensic Locate & Telemetry

## Goal
Locate the single authoritative place where XPBD solver builds/filters the edge list and surface telemetry to verify full graph coverage.

## Findings
1.  **Edge Selection Logic:**
    - Located in `src/physics/engine/engineTickXPBD.ts` -> `rebuildXPBDConstraints`.
    - It iterates over `engine.links`, which appears to be the full set of physical links in the graph.
    - **Filtering:** No intentional "active set" or "incident-only" filtering was found in this function. It only filters out edges with invalid endpoints or non-finite rest lengths (safety checks).
    - **Conclusion:** The default behavior seems to be "Full Graph Solve".

2.  **Telemetry Added:**
    - **`totalEdgesGraph`**: Count of `engine.links`.
    - **`edgesSelectedForSolve`**: Count of constraints in `engine.xpbdConstraints`.
    - **`edgesSelectedReason`**: Static string "full" (placeholder for future logic differentiation).

## Changes
- **`src/physics/engine/engineTickTypes.ts`**: Added fields to `xpbdFrameAccum`.
- **`src/physics/engine/engineTickXPBD.ts`**: Populated fields in `solveXPBDEdgeConstraints`.
- **`src/physics/engine/physicsHud.ts`**: Included fields in `PhysicsHudSnapshot`.
- **`src/physics/engine/engineTickHud.ts`**: Mapped accumulator values to snapshot.
- **`src/playground/components/CanvasOverlays.tsx`**: Added "XPBD Edge Coverage" section to HUD.

## Verification
- **HUD Indicator:** New section "XPBD Edge Coverage" shows "Ratio: Solved / Total".
- **Expected Behavior:** Solved count should match Total count (minus any technically invalid edges).
- **Next Steps:** Proceed to Run 2 (ensure no hidden upstream filtering) and Run 3 (secondary filters audit).
