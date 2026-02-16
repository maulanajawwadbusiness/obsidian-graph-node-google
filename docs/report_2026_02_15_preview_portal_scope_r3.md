# Report: Preview Portal Scope Run 3

Date: 2026-02-15  
Scope: container-mode style branching for portal overlays to stop viewport/fixed escape behavior.

## Files Changed

1. `src/popup/PopupOverlayContainer.tsx`
2. `src/ui/tooltip/TooltipProvider.tsx`
3. `src/playground/components/AIActivityGlyph.tsx`
4. `src/auth/LoginOverlay.tsx`
5. `src/popup/NodePopup.tsx`
6. `src/popup/MiniChatbar.tsx`
7. `src/popup/ChatShortageNotif.tsx`
8. `src/playground/components/CanvasOverlays.tsx`

## What Was Adjusted

- Added `app` vs `container` mode style branching via `usePortalScopeMode()`.
- Overlay roots/bubbles now support `position: absolute` in container mode:
  - tooltip portal root + bubble
  - popup overlay root
  - login overlay backdrop
  - node popup backdrop
  - mini chat container
  - shortage notification
  - AI activity glyph
- Safety guard for non-portal fixed menu:
  - graph top-right dots/share toolbar is disabled in container mode to avoid fixed viewport escape (`CanvasOverlays`).

## Why

- This run removes the main fixed-position escape pattern in preview mode before coordinate-clamp conversion.
- App mode behavior remains default for graph screen (still fixed/body behavior where expected).

## Remaining for Run 4

- Position/clamp math still uses viewport dimensions in several overlay components.
- Need container-bounds conversion and clamping for:
  - tooltip
  - node popup
  - mini chat
  - shortage notif
