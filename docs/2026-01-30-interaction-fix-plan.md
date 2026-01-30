# [Interaction Fix] UI Unresponsiveness

## Goal Description
Fix the critical bug where UI buttons (Sidebar, Theme, Debug, Preview) are unresponsive due to the global pointer capture on the graph container. The fix must restore UI interactivity WITHOUT breaking the "drag node outside window" feature or normal graph navigation.

## User Review Required
> [!IMPORTANT]
> This fix relies on **Strict Target Filtering**.
> It assumes that legitimate graph interactions (panning, dragging nodes) *always* originate from a click on the `<canvas>` element.
> 
> **Verification Confirmed:**
> - Passive overlays (`MapTitleBlock`, `BrandLabel`) have `pointer-events: none`, so clicks pass through to the canvas (Safe).
> - Active overlays (`Buttons`) have `pointer-events: auto`, so clicks target them (Safe to exclude).

There is **NO** expected downside. This is a standard pattern for mixing Canvas + UI overlays.

## Proposed Changes

### Playground
#### [MODIFY] [GraphPhysicsPlayground.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlayground.tsx)
- Update `onPointerDown` handler (Line 106).
- **Logic Change:** Add a guard clause at the very beginning.
  ```typescript
  // 1. Strict Filter: Only capture if the direct target is the canvas.
  // This allows buttons (children of the container) to handle their own events.
  if (e.target !== canvasRef.current) return;
  ```
- This ensures `setPointerCapture` is ONLY called when the user touches the actual graph surface.

## Verification Plan

### Automated Tests
*None available for pointer event interactions.*

### Manual Verification
1. **Button Integrity:**
   - Click "Controls" (Top Right) -> Sidebar should toggle.
   - Click "Theme" -> Theme should toggle.
   - Click "Text Preview" (Bottom Left) -> Panel should open.
2. **Graph Integrity:**
   - Click & Drag on empty space -> Camera should pan (or node drag if configured).
   - Click & Drag a Node -> Node should move.
   - **Critical Test:** Click & Drag a Node, move mouse *outside* the browser window, then release. The node should stop dragging (capture verification).
3. **Passive Overlay Test:**
   - Click & Drag starting *on top of* the "Antarmuka Pengetahuan" title.
   - It should still drag the graph (because title has `pointer-events: none`).
