# Step 13 Boxed Popup Anchor Local Run 4 - Docs and Counter
Date: 2026-02-16

## Dev counter added
Files:
- `src/runtime/ui/boxedUiPolicy.ts`
- `src/popup/NodePopup.tsx`

Changes:
- Added boxed debug counter key:
  - `boxedNodePopupAnchorLocalPathCount`
- Added helper:
  - `recordBoxedNodePopupAnchorLocalPath()`
- Hooked counter in `computePopupPosition(...)` boxed branch so local-anchor path usage is observable in dev snapshots.

## Docs update
File: `docs/system.md`

Updated boxed NodePopup policy contract:
- boxed popup anchor coordinates are local (canvas/viewport-local).
- do not apply `toViewportLocalPoint` to these boxed anchors.
- retained two-layer anchor/panel rule and scaled-dimension clamp rule.
- added counter `boxedNodePopupAnchorLocalPathCount` to boxed policy counter list.

## Final scope check
- No changes to portal target policy or wheel ownership logic.
- Graph/app mode branch remains unchanged.

## Verification
- Ran `npm run build`.
