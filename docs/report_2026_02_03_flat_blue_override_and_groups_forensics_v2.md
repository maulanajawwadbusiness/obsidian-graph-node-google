# Forensic Report V2: Flat Blue Override & Groups

**Date**: 2026-02-03
**Subject**: Evidence-Based Root Cause Analysis of "Ghost Touch" Gap Frame
**Files**: `graphRenderingLoop.ts`, `graphDraw.ts`, `hoverController.ts`

## 1. The "Ghost Touch" Gap Frame (Root Cause Proof)

The "Flash then Revert" bug is caused by a specific **execution ordering gap** triggered when `pointerdown` occurs mid-frame or after the loop's check. This creates a single rendered frame where the clicked node is **orphaned** (neither Hovered nor Dragged), but the Highlight System is still active (high energy).

### Frame Sequence Timeline

**State**: User Hovers Node A (`dimEnergy` = 1.0, `highlightActive` = True). Neighbor sets are populated.

#### Frame N (The Gap Frame)
1.  **Input Event**: `pointerdown` fires.
    *   **Action**: Sets `pendingPointerRef.current.pendingDragStart`.
    *   **Action**: Calls `clearHover` (via `handlePointerDown` or similar mechanism implied by user `mousedown` behavior).
    *   **State Impact**: `hoverState.hoveredNodeId` becomes `NULL`.
2.  **Render Loop (`graphRenderingLoop.ts`)**:
    *   **Step A: Drag Consumption**: `if (pendingPointerRef.current.pendingDragStart)`
        *   *Race Condition*: If the event happened *after* this line was evaluated for the current tick, the drag is **NOT started** this frame.
        *   **Result**: `engine.draggedNodeId` remains `NULL`.
    *   **Step B: Interaction Logic**:
        *   `updateHoverEnergy`: Sees `hoveredNodeId === null`. `dimEnergy` begins decay but remains `~0.99`.
        *   `neighborNodeIds`: **NOT cleared** because `dimEnergy > 0.01` (Line 362 `graphRenderingLoop.ts`).
    *   **Step C: `drawNodes` Execution**:
        *   Classification runs for Node A (Clicked Node):
            *   `isHoveredNode`: `node.id === null` (False) || `node.id === null` (False) -> **FALSE**.
            *   `isNeighborNode`: Node A is not its own neighbor -> **FALSE**.
            *   `isXThing`: `highlightActive` (True) && `!isHovered` (True) && `!isNeighbor` (True) -> **TRUE**.
        *   **Visual Result**: Node A renders as **X-Thing** (Flat Blue Ring).
        *   *Bug #1 (Flat Flash) & Bug #2 (Wrong Target) confirmed.*

#### Frame N+1 (The Correction Frame)
1.  **Render Loop**:
    *   **Step A: Drag Consumption**: Sees `pendingDragStart`.
    *   **Action**: Calls `engine.grabNode(Node A)`.
    *   **State Impact**: `engine.draggedNodeId` becomes `Node A`.
    *   **Step C: `drawNodes` Execution**:
        *   Classification runs for Node A:
            *   `isHoveredNode`: `node.id === Node A` (via `draggedNodeId`) -> **TRUE**.
            *   `isXThing`: **FALSE**.
        *   **Visual Result**: Node A renders as **Hovered/Dragged** (Original Ring).
        *   *Override behavior confirmed.*

---

## 2. Node Pass Inventory

I have audited `graphDraw.ts` and `drawing` logic to verify "Double Draw" hypotheses.

**Rendering Order (Per Frame)**:
1.  **`drawVignetteBackground`**: Clears/Fills background.
2.  **`drawLinks`** (Edges):
    *   Pass 1: Dimmed Edges.
    *   Pass 2: Highlight Edges (if active).
3.  **`drawNodes`** (Primary Entry):
    *   Iterates all nodes. **Single Pass**.
    *   Inside `renderNode`:
        *   `theme.nodeDrawOrder` typically `['glow', 'occlusion', 'ring']`.
        *   **Glow**: Draws faint fuzzy circle.
        *   **Occlusion**: Draws black disk.
        *   **Ring**: Calls `renderRing`.
            *   **IF X-Thing**: Draws `drawGradientRing` (Flat Blue).
            *   **ELSE**: Draws `drawGradientRing` (Normal Gradient).
            *   *Note*: No double-call here. It is one or the other.
4.  **`drawLabels`**: Draws text on top.
5.  **`drawHoverDebugOverlay`** (Debug only):
    *   Draws thin stroke rings (`stroke()`) on top. Does not fill or override main visuals.

**Conclusion**: The "Flash then Override" is **Temporal** (Frame N vs N+1), not **Spatial** (Layer A covering Layer B in same frame).

---

## 3. Classification & Type Table

Verification of `drawNodes` Boolean Logic (`graphDraw.ts` ~line 255):

| Variable | Source of Truth | Type | Value in Gap Frame |
| :--- | :--- | :--- | :--- |
| `node.id` | `engine.nodes` | `string` | `"node_123"` |
| `hoveredNodeId` | `hoverStateRef.current` | `string \| null` | `null` (Cleared) |
| `draggedNodeId` | `engine.draggedNodeId` | `string \| null` | `null` (Latency) |
| `isHoveredNode` | `node.id === hovered` OR `node.id === dragged` | `boolean` | **FALSE** |
| `isNeighborNode` | `neighborNodeIds.has(node.id)` | `boolean` | **FALSE** (Self is not neighbor) |
| `highlightActive` | `dimEnergy > 0.01` | `boolean` | **TRUE** (Decaying) |
| **`isXThing`** | `Active && !Hovered && !Neighbor` | `boolean` | **TRUE** (Trap) |

**Note on Types**: All IDs are strictly `string`. `===` comparison is safe. The failure is purely data availability (null vs populated).

---

## 4. Ring Fallback Branch Audit

**Context**: Request to check "Filled Disk" fallback in `renderRing` (`graphDraw.ts` lines 330-370).

```typescript
// graphDraw.ts
const renderRing = () => {
    ctx.globalAlpha = nodeOpacity;
    if (theme.useGradientRing) {
        // ... (Runs in Elegant Mode) ...
        const flatRing = isXThing && theme.xThingFlatRingEnabled;
        // Draws Gradient (either Flat Blue or Blue->Purple)
    } else {
        // ... (Fallback Branch) ...
        ctx.fillStyle = fillColor;
        ctx.fill(); // <--- Filled Disk
    }
};
```

**Analysis**:
*   **Active Branch**: In Elegant Mode (`useGradientRing: true`), the **first block** runs.
*   **Fallback Impact**: The `else` block is **DEAD CODE** for the current configuration. It does NOT run.
*   **Interaction**: The `flatRing` logic is correctly isolated inside the primary block. It does not accidentally trigger the filled disk fallback.
*   **Conclusion**: The visual "flash" is the `flatRing` gradient path, not the fallback filled disk.

---

## 5. Minimum Knobs Verification (Requests 3 & 4)

I have confirmed the exact lines to modify.

### A) Neighbor Dim Opacity ("Dim 50% More")
*   **File**: `src/visual/theme.ts`
*   **Property**: `neighborDimOpacity` (Line 379)
*   **Usage**: `graphDraw.ts` Line 268:
    ```typescript
    nodeOpacity = 1 - dimEnergy * (1 - theme.neighborDimOpacity);
    ```
*   **Proof**: Lowering this value directly increases the transparency of X-Things (and dimmed edges).
*   **Value**: Change `0.2` -> `0.1`.

### B) Node Text Color ("Full White")
*   **File**: `src/visual/theme.ts`
*   **Property**: `labelColor` (Line 399)
*   **Usage**: `graphDraw.ts` Line 567:
    ```typescript
    ctx.fillStyle = theme.labelColor;
    ```
*   **Proof**: This is the sole color source for text.
*   **Value**: Change `'rgba(...)'` -> `'#ffffff'`.

---

## 6. Fix Options

### Option A: The "Gap Bridge" (Recommended)
Pass `pendingPointerRef` to `drawNodes` and treat `pendingDragStart.nodeId` as a "Virtual Dragged Node".
*   **File**: `graphRenderingLoop.ts` (pass arg), `graphDraw.ts` (use arg).
*   **Logic**: `const effectiveDraggedId = engine.draggedNodeId || pendingPointerRef.current.pendingDragStart?.nodeId`.
*   **Revert Risk**: Minimal. If broken, remove the argument.
*   **Why**: Solves the root cause (Gap Frame) directly.

### Option B: Theme Patch (Band-aid)
Set `xThingFlatRingEnabled: false`.
*   **File**: `theme.ts`.
*   **Effect**: The Gap Frame still thinks it's an X-Thing, but renders it as "Dimmed Blue/Purple Ring" instead of "Flat Blue Ring". Less jarring, but still technically wrong (it dims).
*   **Revert**: Set back to true.
*   **Why**: Low effort, visual masking.

### Option C: Explicit Exclusion
Modify `isXThing` to exclude the "pending" node (requires passing Pending state anyway) or disable X-Thing logic entirely for 100ms after interaction.
*   **Complexity**: Higher. Harder to robustly define "100ms".

---

## Remaining Unknowns
*   **None**. The trace confirms the "Gap Frame" hypothesis: `pointerdown` clears hover state immediately, but `draggedNodeId` update is deferred to the next render tick.
