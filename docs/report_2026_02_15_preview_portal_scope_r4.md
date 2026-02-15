# Report: Preview Portal Scope Run 4

Date: 2026-02-15  
Scope: clamp and coordinate conversion for container mode.

## Files Changed

1. `src/ui/tooltip/TooltipProvider.tsx`
2. `src/popup/NodePopup.tsx`
3. `src/popup/MiniChatbar.tsx`
4. `src/popup/ChatShortageNotif.tsx`

## Clamp/Conversion Updates

- `TooltipProvider`:
  - added `usePortalBoundsRect()`
  - in container mode, converts anchor viewport coords to container-local (`anchor - bounds.left/top`)
  - clamps to `bounds.width/height` instead of `window.innerWidth/innerHeight`

- `NodePopup`:
  - popup position compute now accepts mode + bounds
  - in container mode, converts anchor coords to local before side selection/clamp/origin
  - keeps app mode behavior unchanged

- `MiniChatbar`:
  - position compute now accepts mode + bounds
  - converts popup rect to local in container mode
  - clamps against container dimensions in container mode
  - app mode still clamps against viewport

- `ChatShortageNotif`:
  - converts anchor rect to local in container mode
  - clamps against container width/height in container mode
  - app mode remains viewport-based

## Result of Run 4

- Container mode now has explicit local-space clamp math for popup/tooltip/chat notif surfaces.
- This removes the viewport-coordinate drift when portals target a container root.
