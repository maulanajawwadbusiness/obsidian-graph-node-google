# Step 10 Wheel Bleed Fix Run 3

Date: 2026-02-16
Scope: overscroll containment to block scroll chaining at boundaries

## Changes

1. Added overscroll containment to NodePopup root and scroller.
- File: `src/popup/NodePopup.tsx`
- Added `overscrollBehavior: 'contain'` to:
  - popup root style (`POPUP_STYLE`)
  - content scroller (`CONTENT_STYLE`)

2. Added overscroll containment to MiniChatbar root and messages scroller.
- File: `src/popup/MiniChatbar.tsx`
- Added `overscrollBehavior: 'contain'` to:
  - chatbar root style (`CHATBAR_STYLE`)
  - messages scroller (`MESSAGES_STYLE`)

## Why

- when overlay scrollers hit edge, browser should not chain wheel scroll upward to page.
- containment is static CSS and does not add runtime listener overhead.

## Run 3 verification

- `npm run build` executed after changes.