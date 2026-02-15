# Report: Preview Portal Scope Run 1

Date: 2026-02-15  
Scope: add portal scope seam skeleton only, no behavior change.

## Changes Made

- Added `src/components/portalScope/PortalScopeContext.tsx`.
- Exported:
  - `PortalScopeProvider({ portalRootEl?, mode })`
  - `usePortalRootEl()`
  - `usePortalScopeMode()`
  - `usePortalBoundsRect()`
- Default behavior preserved:
  - if no provider exists, `usePortalScopeMode()` returns `app`
  - if no provider exists, `usePortalRootEl()` resolves to `document.body`

## Known `createPortal` Sites (for scope routing in run 2)

1. `src/ui/tooltip/TooltipProvider.tsx:224`
2. `src/popup/PopupOverlayContainer.tsx:33`
3. `src/playground/components/AIActivityGlyph.tsx:59`
4. `src/auth/LoginOverlay.tsx:179`

## Escape-Risk Overlay Surfaces (preview embed)

- Portal-based:
  - Tooltip layer (`TooltipProvider`)
  - Popup system (`PopupOverlayContainer` -> `NodePopup`, `MiniChatbar`, `ChatShortageNotif`)
  - AI glyph (`AIActivityGlyph`)
  - Login overlay (`LoginOverlay`, not preview-triggered but still global portal)
- Non-portal fixed in graph tree:
  - Dots menu in `CanvasOverlays` uses fixed positioning (`src/playground/components/CanvasOverlays.tsx:467`)

## Plan Anchors

- Portal root override seam added in this run.
- Next runs will:
  1. route all `createPortal` to `usePortalRootEl()`
  2. add container mode style branches for fixed overlays
  3. add bounds-aware clamp/coordinate conversion for container mode
  4. wire provider only in `SampleGraphPreview` so graph screen remains unchanged.
