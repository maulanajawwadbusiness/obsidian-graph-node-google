# Forensic Report: Drag Highlight & Glow Dimming

**Date:** 2026-02-03
**Subject:** Glow Opacity Bypass, Ring Visuals, Edge Highlight Opacity, and Trigger Refactor

## 1. Forensic: Why Glow Ignores Dim (X-Things Glow Not Dimming)

The "x-things" (dimmed non-neighbor nodes) fail to dim their glow because the glow drawing helper ignores the canvas context's global alpha state (which carries the dimming factor) and overwrites it with its own calculated alpha.

**Evidence:**
1.  **Call Site (`graphDraw.ts`):**
    -   Inside `renderGlow` (Line 282-286), `ctx.globalAlpha` is correctly set to `nodeOpacity` (the dimmed value, e.g., 0.2).
    -   `drawTwoLayerGlow` is called.
2.  **Helper Function (`canvasUtils.ts`):**
    -   Inside `drawTwoLayerGlow` (Line 95), the function calculates `innerAlpha` and `outerAlpha` based on `nodeEnergy` and theme constants (Lines 119-120).
    -   **The Bypass:** It sets `ctx.globalAlpha = outerAlpha` (Line 168) and `ctx.globalAlpha = innerAlpha` (Line 181) directly.
    -   It **fails to multiply** these values by the existing `ctx.globalAlpha`. It treats the calculated alpha as absolute, effectively resetting the opacity to 100% relative to the calculated glow intent, ignoring the `nodeOpacity` set by the caller.

**Glow Bypass Map:**
-   `graphDraw.ts`: `nodeOpacity` calculated (Lines 257-264).
-   `graphDraw.ts`: `ctx.globalAlpha = glowOpacity` (Line 284). **[Alpha = 0.2]**
-   `canvasUtils.ts`: `drawTwoLayerGlow` called.
-   `canvasUtils.ts`: `ctx.globalAlpha = outerAlpha` (Line 168). **[Alpha Reset to ~0.02 (absolute)]** -> Should be `0.02 * 0.2`.
-   **Result:** Glow draws at full configured brightness, ignoring the dimming state.

## 2. Forensic: Ring Visual Chain (X-Things Flat Blue)

The ring visualization for x-things (idle state) is built using a gradient ring helper.

**Ring Recipe:**
1.  **Base Color:** `theme.primaryBlueDefault` (#63abff) (Line 328, `graphDraw.ts`).
2.  **Target Color:** `theme.deepPurple` (#4a2a6a) (Line 335, `graphDraw.ts`).
3.  **Method:** `drawGradientRing` interpolates between these two colors.
4.  **Observation:** X-things currently look like a blue-to-purple gradient because `theme.useGradientRing` is active in the Elegant theme.

**Modification Point for Flat Blue:**
To make x-things flat #63abff without affecting hovered/neighbors, we must intercept the color arguments passed to `drawGradientRing` in `graphDraw.ts`.

-   **Location:** `src/playground/rendering/graphDraw.ts` inside `renderRing` (Lines 322-338).
-   **Variables to Swap:** Override the `endColor` argument.
    -   Current: `theme.deepPurple`
    -   Target: `theme.primaryBlueDefault` (if `!isHoveredNode && !isNeighborNode`).

## 3. Forensic: Edge Highlight Color Opacity -20%

Neighbor edge highlights use `theme.neighborEdgeColor` (#63abff) and fade in using `dimEnergy` as the alpha value.

**Findings:**
-   **Color Definition:** `src/visual/theme.ts` -> `neighborEdgeColor: '#63abff'`.
-   **Application:** `src/playground/rendering/graphDraw.ts` -> `drawLinks` -> Pass 2 (Line 118).
-   **Alpha Logic:** `drawEdgeBatch` is called with `globalAlpha` set to `dimEnergy` (Line 121).

**Recommendation:**
Apply a scalar multiplier in `graphDraw.ts` at the call site. This is cleaner than changing the hex color definition or adding a new theme variable.

-   **Location:** `src/playground/rendering/graphDraw.ts` Line 121.
-   **Change:** `dimEnergy` -> `dimEnergy * 0.8`.

## 4. Forensic: Move Highlight Trigger (Hover → Grab/Drag)

We need to decouple the "Highlight/Dimming System" from the "Hover State". Hover should still trigger tooltips/visual growth, but NOT the global dimming effect.

**Control Flow Refactor:**

1.  **Stop Neighbor Population on Hover:**
    -   **File:** `src/playground/rendering/hoverController.ts`
    -   **Function:** `updateHoverSelection`
    -   **Logic (Line 748):** Change `const activeNodeId = lockedNodeId || newHoveredId;` to `const activeNodeId = lockedNodeId;`.
    -   **Effect:** `neighborNodeIds` and `neighborEdgeKeys` will only be populated when a node is locked (dragged). On simple hover, they will remain empty, preventing the "Highlight" render pass in `graphDraw.ts`.

2.  **Stop Dim Energy Rise on Hover:**
    -   **File:** `src/playground/rendering/hoverEnergy.ts`
    -   **Function:** `updateHoverEnergy`
    -   **Logic (Line 52):** `const shouldDim = hoverStateRef.current.hoveredNodeId !== null;`
    -   **Problem:** This triggers dimming on simple hover.
    -   **Fix:** We need to know if a drag is active. `hoverStateRef` doesn't strictly track "isDragging", but `engine.draggedNodeId` does.
    -   **Proposed Change:** Update `updateHoverEnergy` signature to accept `isInteractionActive` (boolean). Pass `!!engine.draggedNodeId` from `graphRenderingLoop.ts`. Set `shouldDim = isInteractionActive`.

## Render Pass Inventory (Nodes)

1.  **Setup:** `ctx.save()`, reset state.
2.  **Glow Layer (`renderGlow`):**
    -   Calls `drawTwoLayerGlow`.
    -   **Risk:** Currently stomps `globalAlpha`. Needs fix to respect `nodeOpacity`.
3.  **Occlusion Layer (`renderOcclusion`):**
    -   Sets `ctx.globalAlpha = nodeOpacity`.
    -   Draws filled circle (background color).
4.  **Ring Layer (`renderRing`):**
    -   Sets `ctx.globalAlpha = nodeOpacity`.
    -   Calls `drawGradientRing`.
    -   **Risk:** `drawGradientRing` respects alpha correctly (captures/restores).
5.  **Teardown:** `ctx.restore()`.

**Risk List:**
-   **Hover Tooltip:** Reliance on `hoveredNodeId` remains untouched, so tooltips should work.
-   **Drag Release:** We must ensure `dimEnergy` fades out naturally. By linking `shouldDim` to `draggedNodeId` (which becomes null on release), `targetDimEnergy` will drop to 0, and `dimEnergy` will standard exponential decay, providing the desired "fade out on release" effect.
