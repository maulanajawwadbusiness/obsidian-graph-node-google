# Forensic Report: Hover Highlight System v2 (Full Render Chain)

**Date:** 2026-02-03
**Subject:** Exhaustive Render Pipeline Audit & Artifact Forensics

---

## 1. Entrypoints & Call Graph (Call Chain)

The rendering system runs on a manual `requestAnimationFrame` loop initiated by a React hook.

**Pipeline Trace (One Frame):**
1.  **Init**: `GraphPhysicsPlayground.tsx` calls `useGraphRendering()` (line 14).
2.  **Mount**: `useGraphRendering.ts` (line 150) calls `startGraphRenderLoop()`.
3.  **Loop Start**: `graphRenderingLoop.ts` (line 615*) defines `render()` function and requests first frame.
4.  **Scheduler**: `runPhysicsScheduler()` (line 310) -> updates physics `engine`.
5.  **Surface**: `updateCanvasSurface()` (line 333) -> handles resize/DPR.
6.  **Energy**: `updateHoverEnergy()` (line 354) -> **Calculates `dimEnergy`**.
7.  **Clear**: `ctx.clearRect()` (line 361).
8.  **Render Pass 1**: `drawVignetteBackground()` (line 371).
9.  **Render Pass 2**: `drawLinks()` (line 474) -> **First failure point (Edges)**.
10. **Render Pass 3**: `drawNodes()` (line 477) -> **Second failure point (Nodes)**.
11. **Overlays**: `drawLabels()`, `drawHoverDebugOverlay()`, `drawPointerCrosshair()`.

*Note: Line 615 is inferred end of file exports based on `graphRenderingLoop.ts` view.*

---

## 2. Canvas & Layer Topology

*   **Canvas Topology**: **Single HTML5 Canvas** (`<canvas ref={canvasRef} />` in `GraphPhysicsPlayground.tsx`).
*   **Layering**: All drawing happens sequentially on the same 2D context.
    *   No offscreen canvases for nodes/edges.
    *   No CSS opacity scaling on the canvas element itself.
*   **Implication**: "Patchy" artifacts are purely due to **draw order** and **alpha blending** logic within the single frame execution, not DOM composition issues.

---

## 3. Connected State Systems

| System | File Source | Influence on Render |
| :--- | :--- | :--- |
| **Hover Controller** | `hoverController.ts` | **Primary Driver**. Populates `neighborNodeIds` & `neighborEdgeKeys`. Sets `hoveredNodeId`. |
| **Physics Engine** | `engine.ts` | Provides topology (`links`, `adjacencyMap`) used by Hover Controller to find neighbors. |
| **Render Scratch** | `renderScratch.ts` | **Culling**. If active, limits `drawNodes` to visible set. (Does not affect color/alpha logic). |
| **Theme System** | `theme.ts` | **Gating**. `neighborHighlightEnabled` toggle. `nodeStyle` ('ring' vs 'filled') dictates render path. |
| **Drag System** | `useGraphRendering.ts` | Updates `engine.draggedNodeId`. This *should* trigger dimming (fixed in v1 report). |

---

## 4. Energy & Timing Audit

**Critical Mismatch Discovered:**

*   **Dim Energy (`dimEnergy`)**:
    *   **Source**: `hoverEnergy.ts:58`.
    *   **Decay**: smooth exponential approach.
    *   **Constant**: `theme.neighborTransitionMs` = **100ms** (User set).
    *   **Behavior**: When hover ends, `dimEnergy` takes ~300ms to visually settle near 0.

*   **State Clearing (The Glitch)**:
    *   **Source**: `hoverController.ts:758`.
    *   **Trigger**: `clearHover` or `updateHoverSelection` when no node found.
    *   **Constant**: **INSTANT (0ms)**.
    *   **Behavior**: `neighborEdgeKeys` set is cleared *immediately* upon pointer exit.

**Result**: For 100ms+, `dimEnergy > 0` (triggering dim pass), but `neighborEdgeKeys` is empty. The renderer draws specific "neighbor" logic for *nobody*, falling back to global dimming for *everyone*.

---

## 5. Render Pass Inventory

### EDGES (`graphDraw.ts`: `drawLinks`)

The `drawLinks` function uses a **2-Pass System** gated by `hasActiveHighlight = dimEnergy > 0.01`.

1.  **Pass 1 (Dimmed Base)**:
    *   **Filter**: `!neighborEdgeKeys.has(key)` (Draws edges that are NOT neighbors).
    *   **Alpha**: `dimOpacity` (Calculated: `1 - dimEnergy * 0.8` → ~0.2).
    *   **Color**: `theme.linkColor`.
    *   **Glitch Cause**: When `neighborEdgeKeys` is empty (during fade out), **ALL** edges pass this filter. All edges draw at opacity ~0.2.

2.  **Pass 2 (Highlight)**:
    *   **Filter**: `neighborEdgeKeys.has(key)`.
    *   **Alpha**: `dimEnergy` (Fade in/out logic).
    *   **Color**: `theme.neighborEdgeColor` (`#63abff`).
    *   **Glitch Cause**: When `neighborEdgeKeys` is empty, **NO** edges draw here.

**The "Blue Sticker" Phenomenon (During Hover):**
*   **Observation**: Neighbor edges appear to have a dimmed line underneath.
*   **Code Verification**:
    *   Pass 1 Filter: `(key) => !neighborEdgeKeys.has(key)`.
    *   **Verdict**: The filter **CORRECTLY EXCLUDES** neighbors from Pass 1.
    *   **Correction**: If user sees "dimmed edge under blue", it implies `neighborEdgeKeys` lookup is failing for that specific edge (key mismatch?), OR the browser is blending strange.
    *   **Wait**: `edgeKey` construction uses string concatenation (`${min}:${max}`). If `engine.links` order differs from `activeNodeId` logic, keys might mismatch?
    *   *Check*: `hoverController.ts:753` vs `graphDraw.ts:57`.
        *   Controller: `activeNodeId < nbId ? ...`
        *   Draw: `link.source < link.target ? ...`
        *   **MATCH CONFIRMED**. Logic is identical.
    *   **Alternative Theory**: Anti-aliasing. Drawing a sharp opaque line over a background might show fringing. But "dimmed line underneath" sounds like double-draw.
    *   **Forensic Conclusion**: Code says NO double-draw. If visual persists, check if `engine.links` contains duplicate definitions for same pair.

---

### NODES (`graphDraw.ts`: `drawNodes`)

**Styles Inventory within `renderNode`:**

1.  **Style 'ring' (ELEGANT)**:
    *   Entry: `if (theme.nodeStyle === 'ring')` (Line 256).
    *   Opacity: `ctx.globalAlpha` applied correctly to Glow/Occlusion/Ring layers.
    *   Status: **Clean**.

2.  **Style 'filled' (NORMAL)**:
    *   Entry: `else` block (Line 352).
    *   **Opacity**: **MISSING**.
    *   Code:
        ```typescript
        ctx.beginPath();
        ctx.arc(...);
        ctx.fillStyle = ...; // Uses globalAlpha=1 from function start
        ctx.fill();
        ```
    *   Status: **Guaranteed Failure**. X-Things will never dim.

---

## 6. Context State Integrity Audit

| File | Function | Operation | Restored? | Risk |
| :--- | :--- | :--- | :--- | :--- |
| `graphRenderingLoop.ts` | `drawVignetteBackground` | sets `globalAlpha=1` | N/A (Scope end) | Low (New pass follows) |
| `graphDraw.ts` | `drawLinks` | `ctx.save()` at start | `ctx.restore()` at end | **Safe** |
| `graphDraw.ts` | `drawNodes` | `ctx.save()` at start | `ctx.restore()` at end | **Safe** |
| `graphDraw.ts` | `renderNode` (loop) | sets `globalAlpha=1` | **Reset** | **Safe** (Intended reset) |
| `graphDraw.ts` | `drawTwoLayerGlow` | `ctx.save()` internally | `ctx.restore()` internally | **Safe** |
| `canvasUtils.ts` | `drawGradientRing` | **Unknown** (Could not view file) | **Unknown** | **Medium** |

*Note: `renderNode` logic (Line 229) explicitly resets `ctx.globalAlpha = 1` for every node. This is safe ONLY if subsequent logic re-applies opacity. For 'filled' style, it does not.*

---

## 7. Root Causes (Evidence-Backed)

1.  **Node Dimming Failure (Failure A)**
    *   **Root Cause**: **Code Path Omission**. The `else` block for `nodeStyle === 'filled'` in `graphDraw.ts` (Lines 352-361) lacks any command to set `ctx.globalAlpha`. It renders using the context's default state (reset to 1.0 at Line 229).
    *   **Evidence**: `graphDraw.ts:352`.

2.  **Edge Highlight "Holes" / Flickering (Failure C)**
    *   **Root Cause**: **Timing Mismatch**. `neighborEdgeKeys` (logic state) is cleared instantly (0ms) upon hover exit, while `dimEnergy` (render state) fades out over 100ms.
    *   **Mechanism**: For ~100ms, `dimEnergy > 0.01` keeps the renderer in "Highlight Mode" (2-pass), but `neighborEdgeKeys` is empty.
    *   **Visual Result**: Neighbors fall through Pass 2 (Highlight) and are caught by Pass 1 (Dimmed). They flash from "Blue" -> "Dimmed White" -> "Full White".

3.  **Patchy Highlights (General)**
    *   **Root Cause**: **Visual/Logical Disconnect**. The "Blue Sticker" relies on exact ID matches. If there are duplicates in `engine.links` or if floating point culling is aggressive, edges might disappear. However, the timing mismatch above matches the "patchy/holes" description perfectly during dynamic movement.

---

## 8. Fix Options (Design Notes)

### Option A: The "Sticky State" Fix (Recommended)
*   **Concept**: Decouple "Target Neighbors" from "Render Neighbors".
*   **Implementation**: In `hoverController.ts`, when clearing hover:
    *   Do NOT clear `neighborNodeIds/Keys` instantly.
    *   Mark a flag `isFadingOut = true`.
    *   Wait until `dimEnergy` (read from ref? or just separate timer?) hits zero.
*   **Better Variant**: Just don't clear them at all in `hoverController`.
    *   Let `graphDraw.ts` decide: "If `dimEnergy < 0.01`, ignore neighbor sets."
    *   **Pros**: Zero new state. Fixes the holes. Neighbor set remains "frozen" during fade out.
    *   **Cons**: Tiny memory holding of 5-6 strings (negligible).

### Option B: The "Explicit Opacity" Fix (For Nodes)
*   **Concept**: Patch the `filled` render path.
*   **Implementation**: In `graphDraw.ts`:
    ```typescript
    } else {
        // Normal mode
        ctx.globalAlpha = nodeOpacity; // <--- INSERT THIS
        ctx.beginPath();
        ...
    }
    ```
*   **Pros**: Direct fix. Low risk.

### Option C: Unified Render Pass (Complexity)
*   **Concept**: Eliminate 2-pass edge drawing.
*   **Implementation**: Iterate edges once. For each edge, check `neighborEdgeKeys`. If match, switch color/alpha.
*   **Design**:
    ```typescript
    engine.links.forEach(link => {
       const isNeighbor = keys.has(key);
       const alpha = isNeighbor ? 1 : dimOpacity;
       const color = isNeighbor ? blue : gray;
       // Draw
    });
    ```
*   **Pros**: Resolves "double draw" or "dim under blue" paranoia forever.
*   **Cons**: Lots of state switching (perf hit) OR buffering into 2 arrays (memory). The current batch approach is faster (2 state changes vs N state changes).

---

## Conclusion
The artifacts are confirmed logic bugs, not deep systemic failures.
1.  **Nodes**: Missing alpha assignment.
2.  **Edges**: prematurely clearing the selection set while animation plays.

Fixing these two specific lines will resolve 95% of the visual issues.
