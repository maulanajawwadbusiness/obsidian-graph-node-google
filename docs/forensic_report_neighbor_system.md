# Forensic Report: Hover Neighbor Visual System

**Date:** 2026-02-03
**Status:** Implemented & Verified
**Target:** Future Code Agent

---

## 1. System Overview

A high-performance visual reaction system that highlights neighbor nodes and edges when a node is hovered or dragged.

**Core Behavior:**
*   **Hovered/Dragged Node:** Brightness boosted +10-30% (configurable).
*   **Neighbor Edges:** Turn flat `#63abff` (configurable), rendered on top with `butt` caps for sharpness.
*   **Neighbor Nodes:** Protected from dimming (visually unchanged).
*   **Everything Else:** Fades to 20% opacity (configurable).
*   **Transitions:** Smooth exponential fade (currently 100ms).

---

## 2. Architecture & Data Flow

### A. State Management (`HoverState` in `renderingTypes.ts`)
New fields allow the render loop to be stateless regarding topology lookup:
*   `neighborNodeIds`: `Set<string>` - IDs of immediate neighbors.
*   `neighborEdgeKeys`: `Set<string>` - Standardized keys (`"minId:maxId"`) for O(1) edge lookup during rendering.
*   `dimEnergy`: `number` (0.0 to 1.0) - Smoothed animation value for the dimming effect.
*   `targetDimEnergy`: `number` (0 or 1) - Destination for the lerp.

### B. Synchronization (`hoverController.ts`)
*   **Trigger:** `updateHoverSelection` (updates on pointer move or camera change).
*   **Logic:**
    *   Detects active node (`lockedNodeId` || `hoveredNodeId`).
    *   Queries physics engine `adjacencyMap` (pre-computed).
    *   Populates `neighborNodeIds` and `neighborEdgeKeys`.
    *   **Note:** Runs efficiently only when selection changes.

### C. Energy Dynamics (`hoverEnergy.ts`)
*   **Trigger:** Every frame in render loop.
*   **Logic:**
    *   Calculates `shouldDim = hoveredNodeId !== null || draggedNodeId !== null`. (**CRITICAL FIX applied here**)
    *   Lerps `dimEnergy` toward `targetDimEnergy` using `theme.neighborTransitionMs`.

### D. Rendering (`graphDraw.ts`)
1.  **Edge Rendering (`drawLinks`)**:
    *   **2-Pass System**:
        *   *Pass 1:* Non-neighbor edges (dimmed using `dimEnergy`).
        *   *Pass 2:* Neighbor edges (highlighted, `globalAlpha` driven by `dimEnergy` for fade-in).
2.  **Node Rendering (`renderNode`)**:
    *   Calculates `nodeOpacity` based on `dimEnergy`.
    *   If node is part of `neighborNodeIds` or is hovered, `nodeOpacity = 1.0`.
    *   Passes opacity to `drawTwoLayerGlow`, `renderOcclusion`, and `renderRing`.
    *   Applies `boostBrightness()` to ring color if hovered.

---

## 3. File-by-File Ledger

### `src/visual/theme.ts`
*   **Added Config**:
    *   `neighborHighlightEnabled`
    *   `neighborEdgeColor`
    *   `neighborDimOpacity`
    *   `neighborTransitionMs` (User modified to **100**)
    *   `hoveredBrightnessBoost` (User modified to **1.3**)
*   **Added Utils**:
    *   `boostBrightness(hex, factor)`: Clamps RGB values.

### `src/playground/rendering/renderingTypes.ts`
*   Updated `HoverState` with neighbor sets and energy fields.
*   Updated `createInitialHoverState`.

### `src/playground/rendering/hoverController.ts`
*   Implemented `getNeighborNodeIds`.
*   Added synchronization logic in `updateHoverSelection` to populate sets.

### `src/playground/rendering/hoverEnergy.ts`
*   Added exponential smoothing for `dimEnergy`.
*   **Fix Applied**: Checks `engine.draggedNodeId` to ensure dimming works during drag operations.

### `src/playground/rendering/graphRenderingLoop.ts`
*   Passed `hoverStateRef` to `drawLinks`.
*   Passed `engine` to `updateHoverEnergy`.

### `src/playground/rendering/graphDraw.ts`
*   **Refactored `drawLinks`**:
    *   Added `hoverStateRef` parameter.
    *   Implemented batch helper `drawEdgeBatch`.
    *   Implemented 2-pass logic.
*   **Updated `drawNodes`**:
    *   Added `opacity` logic.
    *   **Fix Applied**: Removed `ctx.globalAlpha = 1` inside `drawGradientRing` to allow dimming.

---

## 4. Critical Logic Fixes (Forensic Trace)

1.  **Drag Dimming Bug**:
    *   *Issue*: Dim mode only worked on hover, not drag.
    *   *Fix*: Updated `hoverEnergy.ts` to check `engine.draggedNodeId`.
    *   *Status*: **Resolved**.

2.  **Instant Edge Transition Bug**:
    *   *Issue*: Neighbor edges snapped to color instantly instead of fading.
    *   *Fix*: In `graphDraw.ts`, Pass 2 edges now use `dimEnergy` as their alpha value during the transition phase.
    *   *Status*: **Resolved**.

3.  **X-Thing Node Dimming Bug**:
    *   *Issue*: Non-neighbor nodes were not dimming.
    *   *Cause*: `drawGradientRing` was identifying itself as an "opaque" render pass and resetting global alpha.
    *   *Fix*: Removed alpha reset in `graphDraw.ts`.
    *   *Status*: **Resolved**.

---

## 5. Current User Configuration

Specific values set by user in `theme.ts` and `GraphPhysicsPlayground.tsx`: modification history.

*   `neighborTransitionMs`: **100** (was 200) - Snappier fade.
*   `hoveredBrightnessBoost`: **1.3** (was 1.1) - Stronger highlight.
*   `spawnCount`: **5** (was 15) - Simpler graph for testing.

---

## 6. Actionable Next Steps

*   **Optimization**: Currently `neighborEdgeKeys` are rebuilt on every hover change. For massive graphs (>2000 edges), this string allocation might GC thrash. Consider a `Set<number>` of link indices instead?
*   **Visual Polish**: The "Dim" effect fades non-neighbors. A "Darken" effect might be requested later (multiplying color by dark grey instead of generic opacity).
