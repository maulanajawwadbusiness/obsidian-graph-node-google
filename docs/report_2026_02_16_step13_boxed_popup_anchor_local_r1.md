# Step 13 Boxed Popup Anchor Local Run 1 - Core Anchor Conversion Fix
Date: 2026-02-16

## Scope
Patched the boxed anchor conversion bug in NodePopup positioning.

## Change
File: `src/popup/NodePopup.tsx`

- In `computePopupPosition(...)`, boxed anchor handling now treats incoming anchor coordinates as local:
  - from: `toViewportLocalPoint(anchor.x, anchor.y, viewport)`
  - to: `{ x: anchor.x, y: anchor.y }`

This removes boxed double-subtraction that pushed anchors negative and forced clamp to `minLeft`.

## Dev rail added
- Added one warn-once guard in `computePopupPosition(...)` for boxed mode:
  - warns if local anchor is outside local viewport range by small tolerance.
  - message: `[NodePopup] boxed local anchor out of range ...`

## Expected impact
- Boxed popup is no longer systematically pinned to the left due to coordinate-space mismatch.
- App mode branch remains unchanged.

## Verification
- Ran `npm run build`.
