# Report: Preview Portal Scope Run 2

Date: 2026-02-15  
Scope: route all `createPortal` callsites to portal scope root, no intentional behavior change.

## Files Changed

1. `src/ui/tooltip/TooltipProvider.tsx`
2. `src/popup/PopupOverlayContainer.tsx`
3. `src/playground/components/AIActivityGlyph.tsx`
4. `src/auth/LoginOverlay.tsx`

## What Changed

- Replaced direct `document.body` portal targets with `usePortalRootEl()`.
- No provider is wired yet, so effective default root remains `document.body`.
- Existing graph screen behavior should remain unchanged in this run.

## Default Behavior Confirmation

- `usePortalRootEl()` falls back to browser `document.body` when no `PortalScopeProvider` is present.
- `AppShell` currently does not wrap app content with portal scope provider, so all portals still resolve to body by default.

## Notes

- This run is a refactor seam only.  
- Container-specific styles and coordinate clamping are still pending for run 3/run 4.
