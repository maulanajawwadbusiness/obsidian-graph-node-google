# Step 13 NodePopup Anchor Fix Run 2 - Two-Layer Anchor/Scale Refactor
Date: 2026-02-16

## Core fix
Refactored `src/popup/NodePopup.tsx` to decouple position and scale.

### Before
- One element handled all of these at once:
  - `left/top` placement
  - dynamic `transformOrigin`
  - scale animation + boxed scale
- This made anchor placement sensitive to scale/origin coupling.

### After
- Two-layer structure:
  1) **Anchor wrapper** (`anchorRef`): positioned only (`left/top`), unscaled.
  2) **Popup panel** (`panelRef`): visual surface, scaled with transform.

## Implementation details
- Added styles:
  - `POPUP_ANCHOR_STYLE` (positioning layer)
  - `POPUP_PANEL_STYLE` (visual panel layer)
- `BOXED_NODE_POPUP_SCALE` still drives boxed scale.
- Measurement and clamp path now reads unscaled panel dimensions (`panelRef.offsetWidth/offsetHeight`) and feeds scaled dims into `computePopupPosition(...)`.
- Sync update now writes:
  - `anchorRef.style.left/top`
  - `panelRef.style.transformOrigin`
- Boxed mode transform origin forced to `top left` to avoid origin/scale drift.
- App mode keeps origin-driven behavior.

## Compatibility checks
- Popup id `arnvoid-node-popup` remains on the visual panel for MiniChatbar coupling.
- `ChatShortageNotif` anchor ref switched to `panelRef` to track visual popup surface.
- Wheel handlers and scrollable markers unchanged.

## Verification
- Ran `npm run build`.
