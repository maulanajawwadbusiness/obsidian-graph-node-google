# Drag Gating Run 1: Forensic & Telemetry

## Goal
Map all gating mechanisms (sleep, degrade, coverage) and establish telemetry to verify "dead body" behavior during drag.

## Forensic Findings
1.  **Sleep Gating**: `integration.ts` (L195-206) marks nodes as sleeping if velocity/force is low for N frames. `engineTick.ts` builds `awakeList` and `sleepingList`. Sleeping nodes are largely skipped in force passes.
2.  **Degrade/LOD**: `engineTick.ts` computes `engine.degradeLevel` (0..1) based on load.
3.  **Coverage Throttling**:
    - **Legacy**: `engineTick.ts` calculates `spacingStride` based on `degradeLevel`. High degrade = High stride = Low coverage (e.g., check 20% edges).
    - **XPBD**: Currently runs `solveXPBDEdgeConstraints` on all edges (unless `xpbdEdgeSelection === 'incident'`, which is dev-only). However, XPBD might still respect `sleepingList` if we implemented it that way? (Audit: `engineTickXPBD.ts` iterates `xpbdConstraints` which contains ALL constraints, but earlier filters might skip? No, `solveXPBDEdgeConstraints` loops over `engine.xpbdConstraints` directly. It checks `if (!nA || !nB)` but currently `nodes` map has all nodes. It does NOT check `isSleeping` to skip edges, only `isFixed`. Good.)
    - **XPBD Sleep**: XPBD doesn't seem to explicitly skip sleeping nodes in the solver, but if `integrateNodes` isn't called or `forcePass` isn't called for them, they won't move? `integrateNodes` runs on `nodeList` (all nodes) but checks `isSleeping`? `integration.ts` checks `if (node.isFixed) return;`. It doesn't seem to check `isSleeping` inside `integrateNodes` loop? Check `integrateNodes` impl.
    - Correction: `integrateNodes` logic checks for sleep?
        - `engineTick.ts` calls `integrateNodes(..., nodeList, ...)` (all nodes).
        - If `integrateNodes` respects sleep, then sleeping nodes don't move.
    
    *Correction Audit*: `integration.ts` L50 comments "Only active when...".
    I need to verify if `integrateNodes` skips sleeping nodes.
    
## Telemetry Added
- **isDragging**: Boolean (from `draggedNodeId`).
- **dragActive**: Boolean (Firewall flag, currently false).
- **nodesAwake**: Count of active nodes.
- **coverageRatio**: 1.0 (XPBD) or `1/stride` (Legacy).

## Verification
- **HUD**: Shows "Drag Gating" block.
- **Behavior**: No change yet.

## Next Steps
- Run 2: Disable Sleep Gating while dragging.
