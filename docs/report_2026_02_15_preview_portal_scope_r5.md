# Report: Preview Portal Scope Run 5

Date: 2026-02-15  
Scope: wire portal scope provider/root into `SampleGraphPreview` only, and update system docs.

## Files Changed

1. `src/components/SampleGraphPreview.tsx`
2. `docs/system.md`

## Preview Wiring

- `SampleGraphPreview` now creates an internal portal root layer:
  - `<div data-arnvoid-preview-portal-root="1" ... />`
- Preview runtime mount is wrapped with:
  - `PortalScopeProvider mode="container" portalRootEl={portalRootEl}`
  - nested `TooltipProvider`
- This wiring is preview-only.
- Graph screen path remains unchanged because no app-level provider was added.

## Behavior Intent

- Portal overlays rendered by graph runtime in preview now target the internal container root.
- Combined with run 3 and run 4 style/clamp changes, popup/tooltip/chat surfaces are container-scoped for preview mode.

## Docs Updated

- `docs/system.md` preview section now documents:
  - portal scope seam
  - preview portal root marker
  - graph-screen unchanged default
  - updated verification checklist
  - deferred risks (wheel guard, overlay masking, listener cleanup)
