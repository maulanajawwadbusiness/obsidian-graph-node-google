# Forensic Report: Hover Detection Failure

## Status: Investigating "Dead Hover"
User reports that hover detection is non-functional ("dead"). No nodes highlight.

## Suspect Code Analysis

### 1. Data Pipeline
- **Engine**: Generates nodes.
- **RenderScratch**: Culls nodes and populates `hitGrid` (SpatialGrid).
- **GraphRenderingLoop**: Calls `renderScratch.prepare`. Matches visible bounds.
- **HoverController**: Uses `renderScratch.hitGrid` to query candidates.

### 2. Evidence & Consistency Logic

#### A. Is RenderScratch Populated?
- **Logic**: `graphDraw.ts` uses `renderScratch.visibleNodeIndices` to draw nodes.
- **Observation**: If nodes are visible on screen, `visibleNodeIndices` MUST be populated.
- **Inference**: `renderScratch.prepare()` is running and adding nodes to `visibleNodeIndices`.
- **Constraint**: The `hitGrid.add()` call is adjacent to `visibleNodeIndices.push()`. Thus, `hitGrid` MUST be populated.

#### B. Is SpatialGrid Broken?
- **Hashing**: `((Math.floor(x/100) & 0xFFFF) << 16) | (Math.floor(y/100) & 0xFFFF)`.
- **Query**: Scans 3x3 buckets around cursor.
- **Safety**: Valid for standard world coordinates (+/- 20,000).
- **Risk**: If coordinates are NaN, grid fails. But rendering works, so coordinates are likely valid.

#### C. Is HoverController Querying Correctly?
- **Inputs**: `worldX`, `worldY`. Derived from `clientToWorld`.
- **Logic**: `renderScratch.hitGrid.query(worldX, worldY)`.
- **Failure Mode**: If `cameraRef` is stale, `worldX` is wrong.
    - `updateHoverSelectionIfNeeded` uses `cameraRef.current`.
    - `graphRenderingLoop` updates `cameraRef.current` inside `render()` loop before hit test.
    - **Verdict**: Coordinates should be effectively correct.

### 3. Potential Root Causes

1.  **Scope/Closure Stale State**:
    - `hoverController` is created once in `useGraphRendering`.
    - Does it capture a stale `renderScratch` reference?
    - **Check**: `updateHoverSelection` is passed `renderScratch` as an argument in `graphRenderingLoop`. It does NOT rely on closure capture of `renderScratch`. It IS passed.
    - **Verdict**: Unlikely stale reference.

2.  **Hit Test Loop**:
    - `hoverController.ts` Line 173: `renderScratch.hitGrid.query(...)`.
    - `checkCandidate`: calls `evaluateNode`.
    - `distance` check.
    - If `hitRadius` calculation is wrong (e.g. 0), it never hits.
    - **Code Check**: `hitRadius = outerRadius + padding`. Should be positive.

3.  **Variable Shadowing / Typo**:
    - `graphRenderingLoop.ts` calls `updateHoverSelection` with `renderScratch`.
    - `updateHoverSelection` signature accepts `renderScratch`.
    - It passes it to `findNearestNode`.
    - It uses it.

### 4. Proposed Debugging
1.  **Console Logging**: Add log in `findNearestNode` to see if `renderScratch` is truthy and `hitGrid` has entries.
2.  **Visual Debug**: Check if `renderScratch.visibleNodesCount` matches rendered count.

### Conclusion
Code appears logically sound. The failure is likely a subtle runtime interaction (e.g., `hitGrid` cleared but not refilled effectively due to bounds mismatch, or query coordinates off).
**Next Step**: Instrument `hoverController` to confirm `hitGrid` activity.
