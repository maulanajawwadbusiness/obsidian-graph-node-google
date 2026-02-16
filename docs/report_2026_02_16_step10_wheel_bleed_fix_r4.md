# Step 10 Wheel Bleed Fix Run 4

Date: 2026-02-16
Scope: overlay-level wheel safety gates (defense in depth)

## Changes

1. Added conditional overlay wheel capture handler in `NodePopup`.
- File: `src/popup/NodePopup.tsx`
- `onWheelCapture` now:
  - always `stopPropagation()`
  - calls `shouldAllowOverlayWheelDefault(...)`
  - `preventDefault()` when no scroll consumer can consume

2. Added conditional overlay wheel capture handler in `MiniChatbar`.
- File: `src/popup/MiniChatbar.tsx`
- Same policy as above.

3. Added conditional overlay wheel capture handler in `ChatShortageNotif`.
- File: `src/popup/ChatShortageNotif.tsx`
- Same policy as above (typically non-scrollable, so it prevents default).

## Effect

- overlays are now safe standalone even if preview-root policy regresses.
- non-scrollable overlay regions no longer allow browser page-scroll fallback.

## Run 4 verification

- `npm run build` executed after changes.