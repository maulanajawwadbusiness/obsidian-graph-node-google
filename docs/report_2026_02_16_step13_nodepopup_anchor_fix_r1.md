# Step 13 NodePopup Anchor Fix Run 1 - Forensic Pipeline Audit
Date: 2026-02-16

## Scope
Forensic only, no behavior changes.

## Positioning pipeline (current)
File: `src/popup/NodePopup.tsx`

1. Anchor geometry source:
- initial paint uses `anchorGeometry` from popup store.
- sync path uses `graph-render-tick` and computes node center with `detail.transform.worldToScreen(...)`.

2. Coordinate space conversion:
- `computePopupPosition(...)` branches by viewport mode.
- boxed mode converts anchor to boxed-local with `toViewportLocalPoint(anchor.x, anchor.y, viewport)`.
- clamp uses boxed viewport dimensions via `getViewportSize(...)`.

3. Size inputs for clamp:
- width/height measured via `popupRef.current.offsetWidth/offsetHeight` and multiplied by `popupScale`.

4. DOM application:
- same popup element gets:
  - `left/top` positioning
  - `transformOrigin` set from `originX/originY` (dynamic)
  - `transform` containing both reveal scale and `popupScale`.

## Root cause hypothesis (confirmed high-confidence)
Anchor drift is caused by coupling scale and anchor-origin on the same positioned element:
- dynamic `transformOrigin` (`originX/originY`) + `transform: ... scale(...)` moves visual geometry relative to the set `left/top` anchor.
- changing `BOXED_NODE_POPUP_SCALE` changes that displacement, so node adjacency degrades.

This matches the observed symptom: larger/smaller boxed scale changes offset from node.

## Constraint checks
- Wheel ownership seam remains in place (`onWheelCapture={stopOverlayWheelPropagation}`), with scrollability marker on content.
- Portal policy remains boxed-safe via `PopupOverlayContainer` + `resolveBoxedPortalTarget(...)`.

## Implementation direction for next run
Use two-layer structure:
- outer anchor wrapper: unscaled positioning (`left/top`) only.
- inner panel: scaled visually (`transform: scale(...)`, `transformOrigin: top left` in boxed mode).

This removes translation-scale coupling while preserving clamp math.
