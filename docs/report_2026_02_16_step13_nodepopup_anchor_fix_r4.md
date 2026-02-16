# Step 13 NodePopup Anchor Fix Run 4 - Final Tune and Docs
Date: 2026-02-16

## Gap and offset stability
- `GAP_FROM_NODE` remains a fixed pixel constant (`20`) in `src/popup/NodePopup.tsx`.
- It is applied once in `computePopupPosition(...)` and is not scaled.
- With two-layer anchor/panel structure, changing `BOXED_NODE_POPUP_SCALE` no longer distorts node adjacency math.

## Docs updates
- File: `docs/system.md`
- Updated boxed NodePopup policy section to encode anchor+scale contract:
  - outer wrapper handles unscaled placement (`left/top`)
  - inner panel handles scale (`transformOrigin: top left` in boxed)
  - clamp uses scaled panel dimensions
  - `GAP_FROM_NODE` remains px-based and unscaled
  - app mode remains unchanged

## Final audit grep
- `BOXED_NODE_POPUP_SCALE` usage remains scoped to boxed policy + NodePopup.
- Two-layer wrapper refs (`anchorRef`, `panelRef`) only appear in `NodePopup`.
- No unintended wrapper/scaling changes in other popup surfaces.

## Verification
- Ran `npm run build`.
