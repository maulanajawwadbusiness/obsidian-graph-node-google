# Forensic Report: Drag Highlight & Glow Dimming V3 (Full Chain)

**Date:** 2026-02-03
**Subject:** Full Render Chain, Glow Pipeline, CTX Audit, and Drag-Only Trigger Strategy

## 0. Full Render Chain Map (One Frame)

### React Entrypoint & Canvas Setup
- **Component:** `GraphPhysicsPlayground` (src/playground/GraphPhysicsPlayground.tsx)
- **Canvas:** Single `<canvas>` element.
  - **Styles:** `position: absolute`, `inset: 0`, `width: 100%`, `height: 100%`.
  - **Opacity:** No CSS opacity applied to the canvas itself. Alpha compositing happens within the context.
  - **Offscreen:** No offscreen canvas caching observed in the main render loop. Direct drawing to the visible canvas.

### Render Loop (`startGraphRenderLoop` in `src/playground/rendering/graphRenderingLoop.ts`)
The `requestAnimationFrame` loop drives the entire frame.

1.  **Physics Step:** `runPhysicsScheduler` (Line 310) -> Updates node positions.
2.  **Surface Sync:** `updateCanvasSurface` (Line 333) -> Resizes canvas/DPR if needed.
3.  **Hover/Interaction Update:** `updateHoverSelectionIfNeeded` (Line 460)
    -   *Crucial:* This currently updates `hoverStateRef` (rendered radius, target energy, neighbor sets) based on pointer position.
    -   *Touchpoint:* `hoverController.ts` `updateHoverSelection`.
4.  **Hover Energy Update:** `updateHoverEnergy` (Line 354)
    -   Updates `energy` (hover growth) and `dimEnergy` (neighbor highlight fade).
5.  **Clear & Background:**
    -   `ctx.clearRect` (Line 369).
    -   **Pass 1:** `drawVignetteBackground` (Line 379). Use `ctx.globalAlpha = 1`.
6.  **Camera Safety:** `enforceCameraSafety` (Line 403).
7.  **Render Pass 2: Edges (`drawLinks`)** (Line 482)
    -   **File:** `src/playground/rendering/graphDraw.ts`
    -   **Logic:**
        -   If `dimEnergy > 0.01` (highlight active):
            -   **Sub-pass 2a:** Dimmed non-neighbors (Alpha = `1 - dimEnergy * (1 - neighborDimOpacity)`).
            -   **Sub-pass 2b:** Highlighted neighbors (Alpha = `dimEnergy`, Color = `neighborEdgeColor`).
        -   Else: Standard links (Alpha = 1).
8.  **Render Pass 3: Nodes (`drawNodes`)** (Line 485)
    -   **File:** `src/playground/rendering/graphDraw.ts`
    -   **Logic:** Iterates all nodes (or visible subset via scratch).
        -   Calculates `nodeOpacity` based on `dimEnergy`, `hoveredNodeId`, `neighborNodeIds`.
        -   **Layer 3a: Glow** (`renderGlow` -> `drawTwoLayerGlow`).
        -   **Layer 3b: Occlusion** (`renderOcclusion`).
        -   **Layer 3c: Ring/Body** (`renderRing` / filled path).
9.  **Render Pass 4: Labels (`drawLabels`)** (Line 500)
    -   Draws text on top of nodes.
10. **Render Pass 5: Overlays** (Line 512)
    -   Debug overlays, pointer crosshair.

## 1. Glow Pipeline Inventory

| Glow Source | File | Function | Visual Role | Alpha Formula | Respects `globalAlpha`? | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Two-Layer Glow** | `canvasUtils.ts` | `drawTwoLayerGlow` | Main node glow (inner/outer) | `inner/outerAlpha` derived from `nodeEnergy` + constants | **NO (STOMP)** | Takes calculated alpha and assigns directly to `ctx.globalAlpha`, ignoring caller's `nodeOpacity`. |
| **Simple Glow** | `graphDraw.ts` | `renderGlow` (Branch: `theme.glowEnabled`) | Legacy single-layer glow | `theme.glowAlpha` (constant) | **NO (Stomp via fillStyle?)** | Code uses `ctx.filter` and `ctx.fillStyle` with global alpha, but branch structure implies it hasn't been audited for dimming. (Legacy path, currently disabled in Elegant) |
| **Hover Halo** | `graphDraw.ts` | `drawHoverDebugOverlay` | Debug visualization | Constant (0.4 / 0.5) | **NO** | Debug only, resets alpha to 1. |
| **Selection Glow** | N/A | N/A | N/A | N/A | N/A | No separate selection glow found; relies on hover state. |

**Detail: `drawTwoLayerGlow` (The culprit)**
-   **Call Site:** `graphDraw.ts` Line 296 calling `drawTwoLayerGlow`.
-   **Inputs:** `nodeEnergy` (should be 0 for x-things), `theme`.
-   **Implementation:** `canvasUtils.ts` Line 95.
    -   Calculates `innerAlpha` and `outerAlpha`.
    -   **Line 168:** `ctx.globalAlpha = outerAlpha;` (Assignment, not multiplication).
    -   **Line 181:** `ctx.globalAlpha = innerAlpha;` (Assignment).
    -   **Result:** The carefully calculated `nodeOpacity` (e.g., 0.2) set in `graphDraw.ts` Line 284 is effectively discarded.

## 2. Prove Why It Looks "Not Dimmed" (Quantitative)

**Scenario:** Elegant Theme, Highlighting Active (`dimEnergy` = 1.0).
**Target:** "X-Thing" Node (Not hovered, not neighbor).

1.  **Node Opacity Calculation (`graphDraw.ts`):**
    -   `isHoveredNode` = false.
    -   `isNeighborNode` = false.
    -   `dimEnergy` = 1.0.
    -   `theme.neighborDimOpacity` = 0.2.
    -   `nodeOpacity` = `1 - 1.0 * (1 - 0.2)` = **0.2**.
    -   `ctx.globalAlpha` is set to **0.2** at Line 284 inside `renderGlow`.

2.  **Node Energy for X-Thing:**
    -   `isDisplayNode` = false (mostly).
    -   `nodeEnergy` = 0.

3.  **Glow Alpha Calculation (`canvasUtils.ts` - `drawTwoLayerGlow`):**
    -   `nodeEnergy` (e) = 0.
    -   `idleMultiplier` = 8.0 (Elegant Theme).
    -   `glowInnerAlphaBase` = 0.025.
    -   `idleMask` = 1 (since e=0).
    -   **Calculated Inner Alpha:**
        -   Base: 0.025
        -   Boost: 0
        -   Idle Extra: `0.025 * (8.0 - 1) * 1` = 0.175.
        -   Total Inner: 0.025 + 0.175 = **0.20**.
    -   **Calculated Outer Alpha:**
        -   Base: 0.0125
        -   Idle Extra: `0.0125 * (7) ` = 0.0875.
        -   Total Outer: **0.10**.

4.  **The Stomp:**
    -   `drawTwoLayerGlow` sets `ctx.globalAlpha` to **0.10** (outer) and **0.20** (inner).
    -   **Expected Visual (if dimmed):** `0.20 * 0.2 (dim)` = **0.04** alpha.
    -   **Actual Visual:** **0.20** alpha.
    -   **Magnification of Error:** The glow is **5x brighter** than it should be (0.20 vs 0.04). This explains why it looks "undimmed" to the eye—it is literally rendering at its full "idle" brightness, which is tuned to be visible against the background.

## 3. CTX State Audit (State Stomping Hunt)

**Scope:** `graphDraw.ts` (Node Rendering)

| File | Function | Operation | Restores? | Risk | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `graphDraw.ts` | `drawNodes` | `ctx.save()` (Orbit) | Yes (Line 523) | Low | Safe wrapper for entire node pass. |
| `graphDraw.ts` | `renderNode` | `ctx.globalAlpha = 1` | N/A | Low | Resets state per node (Line 239). Good hygiene. |
| `graphDraw.ts` | `renderGlow` | `ctx.save()` | Yes (Line 296) | Low | Wraps the glow call. |
| `graphDraw.ts` | `renderGlow` | `ctx.globalAlpha = nodeOpacity` | N/A | **HIGH** | This is the intent, but it's stomped by the callee. |
| `canvasUtils.ts` | `drawTwoLayerGlow` | `ctx.globalAlpha = ...` | **NO** (Manual Loop) | **CRITICAL** | Sets alpha directly. **Does not restore.** relies on caller resetting or `ctx.restore`, but the logic *inside* the function assumes absolute alpha. |
| `canvasUtils.ts` | `drawTwoLayerGlow` | `ctx.globalAlpha = 1` (Cleanup) | N/A | Medium | At Line 191, it resets `globalAlpha = 1`. This safely cleans up for the next calls, but doesn't fix the internal stomp. |

**Findings:**
-   `drawTwoLayerGlow` is "safe" for the *next* operation (it resets alpha to 1), but it breaks the *current* operation's compositing by ignoring the input alpha context.

## 4. Ring Visual Recipe (For Flat Blue X-Things)

**Goal:** X-Things (idle, dimmed) = Flat #63abff. Highlighting/Neighbors = Current Gradient.

**Current Implementation (`graphDraw.ts`):**
-   **Layer:** `renderRing` (Line 322).
-   **Style:** `theme.useGradientRing` is TRUE (Elegant).
-   **Colors:**
    -   `startColor`: `theme.primaryBlueDefault` (#63abff) or `fixedColor` or `hoverBoosted`.
    -   `endColor`: `theme.deepPurple` (#4a2a6a).
-   **Draw Call:** `drawGradientRing(..., startColor, endColor, ...)`

**Recipe for Fix:**
We need to conditionally swap `endColor`.

**Logic Location:** `src/playground/rendering/graphDraw.ts` approx Line 333 (inside `renderRing`).

```typescript
// Current
drawGradientRing(ctx, ..., ringColor, theme.deepPurple, ...);

// Proposed Logic
// We already have 'isHoveredNode' and 'isNeighborNode' computed in renderNode scope.
const isXThing = !isHoveredNode && !isNeighborNode && theme.neighborHighlightEnabled && dimEnergy > 0.01;

// If it's an X-Thing, flatten the gradient by making endColor == startColor
// Or just use the flat blue color directly.
const endRingColor = isXThing ? theme.primaryBlueDefault : theme.deepPurple;

drawGradientRing(ctx, ..., ringColor, endRingColor, ...);
```

**Theme Variables:**
-   `theme.primaryBlueDefault` (#63abff)
-   `theme.deepPurple` (#4a2a6a)

## 5. Edge Highlight Opacity -20% Scan

**Current State:**
-   Theme: `neighborEdgeColor` = `#63abff`.
-   Pass 2b (Highlight): `ctx.globalAlpha = dimEnergy` (Line 121 `graphDraw.ts`).

**Constraint:** We want the highlighted edges to be 80% opacity MAX, but still fade in/out with `dimEnergy`.

**Bulletproof Method:**
Multiply `dimEnergy` by `0.8` at the call site.

-   **File:** `src/playground/rendering/graphDraw.ts`
-   **Function:** `drawLinks` -> `drawEdgeBatch` call for neighbors (Line 118-123).
-   **Code:**
    ```typescript
    drawEdgeBatch(
        theme.neighborEdgeColor,
        'butt',
        dimEnergy * 0.8, // <--- THE FIX
        (key) => neighborEdgeKeys.has(key)
    );
    ```
-   **Why Safe?** `drawEdgeBatch` sets `ctx.globalAlpha` directly to the passed value (Line 49). It does not perform any other alpha math. This ensures a clean 0.8 cap without side effects on the dim pass (which handles its own alpha).

## 6. Drag-Only Trigger Scan

**Authoritative Source of Truth:**
-   **Drag Active:** `engine.draggedNodeId` (string | null).
    -   This is managed by `engine.grabNode` and `engine.releaseNode`.
    -   Updated in `graphRenderingLoop.ts` via `pendingPointerRef`.

**Handlers Map:**
-   **Pointer Down:** `hoverController` -> `handlePointerMove` (tracking) -> `graphRenderingLoop` checks `pendingPointerRef.pendingDragStart`.
-   **Drag Start:** `graphRenderingLoop.ts` Line 291. Consumes `pendingDragStart`, calls `engine.grabNode`.
-   **Drag Move:** `graphRenderingLoop.ts` Line 543 `applyDragTargetSync`. Calls `engine.moveDrag`.
-   **Pointer Up:** `hoverController.ts` `handlePointerUp` -> `clearHover`.
    -   *Gap:* `hoverController` doesn't directly release the engine node?
    -   *Check:* `GraphPhysicsPlayground.tsx` usually handles `onPointerUp` to call `engine.releaseNode()`.

**Proposed Drag-Only Control Flow:**

1.  **Refactor `hoverController.ts`:**
    -   **Goal:** `neighborNodeIds` should NOT populate on simple hover.
    -   **Change:** In `updateHoverSelection`, remove the logic that auto-fills neighbors for `newHoveredId`.
    -   **New Logic:** Only fill neighbors if `lockedNodeId` (which corresponds to `draggedNodeId`) is present.

2.  **Refactor `hoverEnergy.ts`:**
    -   **Goal:** `targetDimEnergy` should be 0 unless dragging.
    -   **Change:** `const shouldDim = hoverStateRef.current.hoveredNodeId !== null;` -> `const shouldDim = isDragging;`.
    -   **Input:** Need to pass `!!engine.draggedNodeId` into `updateHoverEnergy`.

3.  **Diagram (Concept):**

```mermaid
graph TD
    A[Pointer Move] -->|Hover| B(Hover State Update)
    B -->|Found Node| C[Set hoveredNodeId]
    C -->|No Drag| D[Do NOT calculate Neighbors]
    C -->|No Drag| E[targetDimEnergy = 0]
    
    F[Pointer Down] -->|Grab| G[engine.draggedNodeId = 'nodeA']
    G --> H[HoverController sees activeDrag]
    H --> I[Populate neighborNodeIds for 'nodeA']
    H --> J[updateHoverEnergy: targetDimEnergy = 1]
    
    K[Pointer Up] -->|Release| L[engine.draggedNodeId = null]
    L --> M[HoverController sees No Drag]
    M --> N[Retain neighbor sets (Sticky)]
    M --> O[updateHoverEnergy: targetDimEnergy = 0]
    O -->|Decay| P[dimEnergy fades to 0]
    P -->|When ~0| Q[Clear neighbor sets]
```

**Edge Cases:**
-   **Click without drag:** `draggedNodeId` might briefly be set. If `minDragTime` isn't met, we might get a flash of dimming. *Mitigation:* The `neighborTransitionMs` (100ms) acts as a natural debounce. A 50ms click might start the fade up but immediately release, barely visible.
-   **Touch:** Same logic applies. `draggedNodeId` is the universal truth.

## Remaining Unknowns
-   **Interaction Lock:** I saw `engine.interactionLock` in `graphRenderingLoop.ts`. Ensure this doesn't conflict with the `draggedNodeId` check. It seems to be a safety gate, so relying on `draggedNodeId` is likely safe.
-   **Hover Tooltip:** Since we are keeping `hoveredNodeId` logic intact (just removing the neighbor side-effects), tooltips (driven by `hoveredNodeId`) should continue to function normally.

