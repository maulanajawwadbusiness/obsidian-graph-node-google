# NodePopup Boxed Anchor Forensics — 2026-02-16

> **Bug**: In boxed preview, NodePopup always appears at a fixed left-side position inside the preview box, regardless of which node was clicked.

![Screenshot of the bug](file:///C:/Users/maulana/.gemini/antigravity/brain/8f891cbd-8c60-4765-b472-4729b4fe55f2/uploaded_image_1771217820814.png)

---

## 1) Reproduction Steps

1. Open EnterPrompt screen with sample graph preview visible.
2. Click any node in the boxed preview.
3. **Observe**: NodePopup appears on the far left of the preview, no matter which node was clicked.
4. **Expected**: Popup should appear adjacent to the clicked node (same as graph screen behavior).

---

## 2) Anchor Pipeline — Stage-by-Stage Trace

### Stage A: Initial Click → `anchorGeometry` stored

| Step | File:Line | What happens | Coordinate space |
|------|-----------|--------------|-----------------|
| 1 | [GraphPhysicsPlaygroundShell.tsx:582-583](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L582-L583) | `const rect = container.getBoundingClientRect();` `const screenPos = worldToScreen(node.x, node.y, rect);` | `rect` = canvas page-absolute; `screenPos` returned by… |
| 2 | [hoverController.ts:298-316](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/hoverController.ts#L298-L316) | Creates `CameraTransform(rect.width, rect.height, ...)` then calls `transform.worldToScreen(worldX, worldY)` | Returns **canvas-local** coords (0,0 = canvas top-left corner) |
| 3 | [camera.ts:65-96](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/camera.ts#L65-L96) | `sx = zx + width / 2; sy = zy + height / 2;` — width/height are **rect** dimensions, not window dimensions | **Canvas-local**: origin at canvas corner, center at `width/2, height/2` |
| 4 | [GraphPhysicsPlaygroundShell.tsx:592-596](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L592-L596) | `popupContext.openPopup(start.nodeId, { x: screenPos.x, y: screenPos.y, radius: visualRadius })` | Stored in PopupStore as `anchorGeometry` — still **canvas-local** |

### Stage B: Live Tick Sync → `handleSync`

| Step | File:Line | What happens | Coordinate space |
|------|-----------|--------------|-----------------|
| 1 | [graphRenderingLoop.ts:457-467](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L457-L467) | Render loop creates `CameraTransform(width=rect.width, height=rect.height, ...)` | Uses canvas rect dimensions |
| 2 | [graphRenderingLoop.ts:574-576](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L574-L576) | `window.dispatchEvent(new CustomEvent('graph-render-tick', { detail: { transform, ... } }))` | `transform` has `width/height` baked in as canvas rect dims |
| 3 | [NodePopup.tsx:402-405](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L402-L405) | `handleSync` receives event; `const { x, y } = detail.transform.worldToScreen(node.x, node.y);` | Returns **canvas-local** coords (same as Stage A) |

### Stage C: Position Computation → `computePopupPosition`

| Step | File:Line | What happens | Coordinate space |
|------|-----------|--------------|-----------------|
| 1 | [NodePopup.tsx:144](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L144) | `const boxed = isBoxedViewport(viewport);` → **true** in preview | — |
| 2 | [NodePopup.tsx:155-156](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L155-L156) | **`anchorLocal = toViewportLocalPoint(anchor.x, anchor.y, viewport)`** | ⚠️ **BUG HERE** |
| 3 | [viewportMath.ts:57-68](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/runtime/viewport/viewportMath.ts#L57-L68) | `toViewportLocalPoint` subtracts `boundsRect.left` and `boundsRect.top` from coords | Expects **window/client** coords as input, returns viewport-local |
| 4 | [NodePopup.tsx:161-162](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L161-L162) | `anchorX = anchorLocal.x; anchorY = anchorLocal.y;` | **Bogus values** — see below |
| 5 | [NodePopup.tsx:171-178](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L171-L178) | `left = clamp(left, 10, maxLeft); top = clamp(top, 10, maxTop);` | Negative → clamped to **10** → constant-left |

---

## 3) Root Cause: Double-Subtraction of Viewport Origin

### The Bug (one sentence)

`worldToScreen` returns **canvas-local** coordinates (origin at canvas top-left), but `toViewportLocalPoint` assumes its input is in **window/client** space and subtracts `boundsRect.left/top` again. This double-subtraction yields negative/near-zero values → clamp snaps to `minLeft=10`.

### Concrete Example

```
Canvas position on page:  boundsRect = { left: 200, top: 150, width: 400, height: 300 }
Node screen position:     worldToScreen → { x: 250, y: 180 }   (canvas-local)

toViewportLocalPoint does: x = 250 - 200 = 50    ← would be correct if 250 was window-X (it's not)
                           y = 180 - 150 = 30    ← would be correct if 180 was window-Y (it's not)
```

Wait — in this example the values look OK by coincidence. Let me reconsider...

Actually, the values become wrong when the **canvas-local position is small** (node near the left/top of the canvas). If a node is near `x=100` canvas-local and `boundsRect.left=200`, then `toViewportLocalPoint` produces `100 - 200 = -100` → clamped to `10`.

But more critically: in the **graph-render-tick path** (NodePopup.tsx line 405), `detail.transform.worldToScreen` uses `width` and `height` from the render loop's `CameraTransform`. These are `rect.width` and `rect.height` of the canvas. The `worldToScreen` formula is:

```
sx = zoom * (pan + rotated) + width / 2
```

So `sx` ranges from `0` to approximately `width` (canvas width), NOT from `boundsRect.left` to `boundsRect.left + width`. These are **canvas-local, NOT window-absolute**.

Then `toViewportLocalPoint(sx, sy, viewport)` subtracts `viewport.boundsRect.left / .top` (which are the canvas's **page** coordinates), producing values like `sx - boundsRect.left` which would typically be **negative** when `sx < boundsRect.left` or much smaller than expected.

### Why Graph Screen Works

In full-screen `app` mode:
- `isBoxedViewport(viewport)` → **false**
- `computePopupPosition` takes the **non-boxed** branch (line 157-159): no call to `toViewportLocalPoint`
- In app mode, the canvas fills the window, so canvas-local coords ≈ window coords → positioning is correct

### Summary

| Property | Graph Screen (app) | Boxed Preview |
|----------|-------------------|---------------|
| `isBoxedViewport` | `false` | `true` |
| `worldToScreen` output | Canvas-local (≈ window) | Canvas-local (≠ window) |
| `computePopupPosition` path | Skip `toViewportLocalPoint` | **Calls `toViewportLocalPoint`** — double-subtracts |
| Result | Correct position | Clamped to left edge |

---

## 4) Minimal Fix Plan

### Root Fix: Skip `toViewportLocalPoint` in `computePopupPosition` When Input is Already Canvas-Local

The coordinates from `worldToScreen` (both the `handleSync` path and the `openPopup` initial path) are already in **canvas-local** space. In boxed mode, canvas-local IS viewport-local because the canvas fills the boxed container. Therefore, `toViewportLocalPoint` should NOT be applied.

#### Option A: Skip the `toViewportLocalPoint` call for boxed mode (simplest)

**File**: [NodePopup.tsx:155-160](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L155-L160)

```diff
-    const anchorLocal = boxed
-        ? toViewportLocalPoint(anchor.x, anchor.y, viewport)
-        : {
-            x: mode === 'container' && boundsRect ? anchor.x - boundsRect.left : anchor.x,
-            y: mode === 'container' && boundsRect ? anchor.y - boundsRect.top : anchor.y,
-        };
+    const anchorLocal = boxed
+        ? { x: anchor.x, y: anchor.y }  // Already canvas-local from worldToScreen
+        : {
+            x: mode === 'container' && boundsRect ? anchor.x - boundsRect.left : anchor.x,
+            y: mode === 'container' && boundsRect ? anchor.y - boundsRect.top : anchor.y,
+        };
```

**Rationale**: `worldToScreen` returns `(sx, sy)` relative to canvas origin. In boxed mode, the popup container is the same element as the canvas container, so canvas-local coords ARE the correct popup positioning coords. No subtraction needed.

#### Option B (alternative): Convert to window coords before calling `computePopupPosition`

Add `boundsRect.left/top` to the `worldToScreen` output before passing to `computePopupPosition`, so `toViewportLocalPoint` correctly subtracts it back. This is more roundabout but keeps `toViewportLocalPoint` usage consistent.

**In `handleSync`** (NodePopup.tsx:429):
```diff
-const geom = { x, y, radius: screenRadius };
+const geom = {
+    x: x + (viewport.boundsRect?.left ?? 0),
+    y: y + (viewport.boundsRect?.top ?? 0),
+    radius: screenRadius
+};
```

### Recommended: **Option A** — it's 2 lines, zero new logic, zero risk.

### Verification (No IDE/Browser)

1. **Console log check**: Add temporary log inside `computePopupPosition` (boxed path):
   ```ts
   if (boxed) console.log('[PopupPos] anchor=', anchor.x, anchor.y, 'local=', anchorLocal.x, anchorLocal.y, 'vp=', viewportWidth, viewportHeight);
   ```
   - **Before fix**: `local.x` and `local.y` will be near-zero or negative.  
   - **After fix**: `local.x` and `local.y` should be within `[0, viewportWidth]` and `[0, viewportHeight]`.

2. **Manual checklist**:
   - [ ] Click node on the RIGHT side of boxed preview → popup should appear to the LEFT of the node.
   - [ ] Click node on the LEFT side → popup should appear to the RIGHT.
   - [ ] Click node near top edge → popup vertically centered or clamped down (not off-screen).
   - [ ] Popup remains fully inside the preview box (clamp still works).
   - [ ] Graph screen (full runtime) behavior unchanged.

---

## 5) Risks

| Risk | Mitigation |
|------|-----------|
| **Boxed clamp bounds miscalculated** | `getViewportSize` still uses `viewport.width/height` for boxed, which matches the canvas rect used to generate the coords. No change needed. |
| **Portal/body bleed** | Fix does not touch portal routing (`PopupOverlayContainer`, `PortalScopeProvider`). Portal remains scoped to container. |
| **Wheel bleed** | Fix does not touch `stopOverlayWheelPropagation` or the `onWheelCapture` handler. No risk. |
| **Scale (BOXED_NODE_POPUP_SCALE)** | Fix does not alter `popupScale` or the `scale()` transform. Scale still applied correctly in paneStyle. |
| **`warnIfBoxedAnchorOutOfBounds` false-positives** | This debug helper (line 304-327) also calls `toViewportLocalPoint` on the raw anchor — after fix, anchor coords ARE local, so this will also double-subtract. **Should also skip `toViewportLocalPoint`** in this function for consistency, or just pass anchor coords directly as `local`. |
| **Graph screen regression** | Fix only changes the `boxed === true` branch. Non-boxed path is untouched. |
