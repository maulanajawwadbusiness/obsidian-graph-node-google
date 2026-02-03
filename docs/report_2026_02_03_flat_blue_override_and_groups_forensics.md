# Forensic Report: Flat Blue Override & Groups

**Date**: 2026-02-03
**Subject**: Flat Blue Override & Group Classification Debugging
**Files Analyzed**: `graphDraw.ts`, `graphRenderingLoop.ts`, `hoverController.ts`, `theme.ts`

## 1. TL;DR Root Causes
*   **Bug #1 (Flat Blue Flash)**: The grabbed node momentarily evaluates as an **X-Thing** (not Hovered, not Neighbor) because `engine.draggedNodeId` and `hoverState.hoveredNodeId` are likely desynchronized or unset during the very first render frame of the drag action. This triggers the `flatRing` logic in `renderRing` (#63abff), which is then "overridden" (corrected) in subsequent frames when `draggedNodeId` stabilizes.
*   **Bug #2 (Grabbed Node Flat Blue)**: Same root cause. The `isXThing` boolean logic (`!isHoveredNode && !isNeighborNode`) is capturing the grabbed node because `isHoveredNode` fails to identify it (due to the missing ID linkage described above).
*   **Request #3 (X-Thing Dim)**: Controlled by `theme.neighborDimOpacity`. Current 0.2, needs 0.1.
*   **Request #4 (White Text)**: Controlled by `theme.labelColor`. Current `rgba(...)`, needs `#ffffff`.

---

## 2. Render Pass Ordering (Drag Highlight)

For a single frame where **Drag is Active** (`dimEnergy > 0.01`):

1.  **`graphRenderingLoop`**:
    *   `engine.grabNode()` called (sets `draggedNodeId`).
    *   `updateHoverSelection()` called (updates `hoveredNodeId`).
    *   **Calls `drawNodes()`**
2.  **`drawNodes`** (Iterates all nodes):
    *   Calculates `isHoveredNode`, `isNeighborNode`, `isXThing`.
    *   Sets `ctx.globalAlpha = nodeOpacity` (1.0 for protected, 0.2 for X-Things).
    *   **Calls `renderFunctions[layer]`** (Order: Glow → Occlusion → Ring):
        *   **`renderGlow`**:
            *   Checks `theme.useTwoLayerGlow`.
            *   Draws outer/inner glow (Blue/Purple).
            *   *Note: Opacity matches `nodeOpacity` (X-Things = Dim).*
        *   **`renderOcclusion`**:
            *   Draws black disk to component.
        *   **`renderRing`** (The Culprit):
            *   Checks `theme.useGradientRing` (True).
            *   **Condition**: `if (isXThing && theme.xThingFlatRingEnabled)`
                *   **TRUE (Bug path)**: Draws `drawGradientRing` with `start=end=#63abff` (Flat Blue).
                *   **FALSE (Correct path)**: Draws `drawGradientRing` with `start=Fixed/Blue`, `end=Purple`.
3.  **Completion**:
    *   The "Flat Blue" is definitely coming from the `renderRing` → `flatRing` branch. The "Override" behavior confirms `isXThing` flips from True (Bug) to False (Correct) after frame 1.

---

## 3. Classification Logic Table

Current definitions in `graphDraw.ts` (~line 255):

| Logic Boolean | Definition Code | Intent for Grabbed Node | Implementation Reality (Bug) |
| :--- | :--- | :--- | :--- |
| `isHoveredNode` | `node.id === hoveredId || node.id === draggedId` | **TRUE** | **FALSE** (if ids missing) |
| `isNeighborNode` | `neighborNodeIds.has(node.id)` | **FALSE** | **FALSE** |
| `highlightActive` | `theme.enabled && dimEnergy > 0.01` | **TRUE** | **TRUE** |
| `isXThing` | `highlight && !isHovered && !isNeighbor` | **FALSE** | **TRUE** (Captures dragged!) |

**The failure chain:**
`draggedId` missing/mismatch → `isHoveredNode` becomes `false` → `isXThing` becomes `true` → Flat Blue Ring applies.

---

## 4. Flat-Blue Override Cause (Evidence)

**Location**: `src/playground/rendering/graphDraw.ts` lines 342-345

```typescript
// Inside renderRing()
const flatRing = isXThing && theme.xThingFlatRingEnabled; // <--- TRIGGER
const ringEndColor = flatRing ? theme.xThingFlatRingColor : theme.deepPurple;
const ringStartColor = flatRing ? theme.xThingFlatRingColor : ringColor;
```

**Evidence**:
*   The User explicitly enabled `xThingFlatRingEnabled: true` and set color to `#63abff` (Steps 28-31).
*   The User reports seeing "flat blue ring".
*   This code block is the **only place** that color/flag combination exists.
*   Therefore, `isXThing` MUST be evaluating to `true` for the grabbed node during the "split second".

---

## 5. Grabbed-Node-Wrong-Target Cause

**Location**: `src/playground/rendering/graphDraw.ts` lines 255-260

```typescript
const isHoveredNode = node.id === hoverStateRef.current.hoveredNodeId ||
    node.id === engine.draggedNodeId;
const isXThing = highlightActive && !isHoveredNode && !isNeighborNode;
```

**Diagnosis**:
The classification logic is theoretically correct (`isHoveredNode` includes `draggedNodeId`). However, the runtime behavior ("wrong target") proves that `engine.draggedNodeId` is **not reliable** at the exact moment `drawNodes` executes in the first frame of a drag. This creates a 1-frame race condition where the node falls through to the catch-all `isXThing` bucket.

---

## 6. Minimum Knobs Locations

### X-Thing Dim Target (Request #3)
**File**: `src/visual/theme.ts`
**Property**: `neighborDimOpacity`
**Current**: `0.2`
**Target**: `0.1` (to achieve "50% more dim")

```typescript
// theme.ts ~line 379
neighborDimOpacity: 0.2, // Change to 0.1
```

### Node Text Color (Request #4)
**File**: `src/visual/theme.ts`
**Property**: `labelColor`
**Current**: `'rgba(180, 190, 210, 0.85)'`
**Target**: `'#ffffff'`

```typescript
// theme.ts ~line 399
labelColor: 'rgba(180, 190, 210, 0.85)', // Change to '#ffffff'
```

---

## 7. Fix Options (Concept)

**Recommendation**: **Option A (The Robust Guard)**. It is safest to explicitly exclude the dragged node from X-Thing logic, even if `isHoveredNode` fails.

### Option A: Explicit Exclusion (Recommended)
Modify `isXThing` definition in `graphDraw.ts` to explicitly check `draggedNodeId` again, or check "active" status.

```typescript
const isDragged = node.id === engine.draggedNodeId; // redundant but safe
const isHoveredNode = ...;
// Force exclude dragged node from XThings, regardless of hover state
const isXThing = highlightActive && !isHoveredNode && !isNeighborNode && !isDragged;
```

### Option B: Theme Value Adjustments (Requests 3 & 4)
Simply apply the values identified in Section 6.

---

## 8. Unknowns

*   **Why `draggedNodeId` is latent**: `graphRenderingLoop` consumes `pendingDragStart` *before* `drawNodes`. It is chemically impossible for `engine.draggedNodeId` to be null unless `engine.grabNode` is somehow failing silently (e.g., interaction lock) or `node.id` types are mismatching (string vs number). However, explicitly guarding `isXThing` (Option A) solves the visual symptom regardless of the upstream race.
