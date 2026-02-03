# TODO: Flat Blue Fix (8-Run Plan)

**Priority**: High (When Resumed)
**Context**: See forensic report `docs/report_2026_02_03_flat_blue_override_and_groups_forensics_v2.md`.
**Symptoms**:
1.  **Flat Blue Flash**: Clicked node flashes flat blue (X-Thing style) for 1 frame before turning purple/active.
2.  **Wrong Target**: Logic evaluates clicked node as "Not Hovered" due to race condition.

## The 8-Run Plan

### Phase 1: Preparation & Reproduction
- [ ] **Run 1: Reproduction Test**: Create a manual repro script or detailed steps to confirm the "Gap Frame" exists using `console.log` trace in `graphDraw`.
- [ ] **Run 2: Instrument Loop**: Add lightweight logging to `graphRenderingLoop` to catch the exact moment `draggedNodeId` lags `pointerdown`.

### Phase 2: Implementation (Option A - Gap Bridge)
- [ ] **Run 3: Wiring**: Update `GraphRenderLoopDeps` to expose `pendingPointerRef` to the `render` closure (already there, but confirm access path).
- [ ] **Run 4: Bridge Logic**: In `drawNodes`, calculate `effectiveDraggedId = engine.draggedNodeId || (pendingPointerRef.current.pendingDragStart?.nodeId)`.
- [ ] **Run 5: Guard Logic**: Update `isHoveredNode` and `isXThing` definitions to use `effectiveDraggedId`.
    ```typescript
    const isHoveredNode = node.id === hoveredId || node.id === effectiveDraggedId;
    ```

### Phase 3: Verification & Cleanup
- [ ] **Run 6: Verification Trace**: Re-run Run 2's trace to prove the gap is bridged (node stays "Hovered" during frame 1).
- [ ] **Run 7: Cleanup**: Remove any debug logs.
- [ ] **Run 8: Final Commit**: "fix: bridge drag-start gap frame to prevent flat-blue flash".

## Reference
*   **Root Cause**: `pendingDragStart` is queued but `engine.draggedNodeId` is null during the first render tick after a click.
*   **Affected File**: `src/playground/rendering/graphDraw.ts` (mainly).
