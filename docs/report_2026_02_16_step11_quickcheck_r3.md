# Step 11 Quickcheck Run 3 - Apply Hardened Policy To Portal Callsites

Date: 2026-02-16

## Changes
Applied the run-2 boxed portal invariant helper to all preview-reachable runtime portal surfaces:

1. `src/popup/PopupOverlayContainer.tsx`
   - added `assertBoxedPortalTarget(portalRoot, 'PopupOverlayContainer')` in boxed branch before target resolution.
2. `src/ui/tooltip/TooltipProvider.tsx`
   - added `assertBoxedPortalTarget(portalRoot, 'TooltipProvider')` in boxed branch before target resolution.
3. `src/playground/components/AIActivityGlyph.tsx`
   - added `assertBoxedPortalTarget(portalRoot, 'AIActivityGlyph')` in boxed branch before target resolution.

Also removed redundant post-resolution `assertNoBodyPortalInBoxed(...)` calls at these sites. Body-portal assertions are now centralized through `assertBoxedPortalTarget(...)` and `resolveBoxedPortalTarget(...)`.

## Why
1. Guarantees all boxed portal callsites emit actionable warn-once diagnostics if portal root is missing.
2. Keeps portal safety checks consistent and centralized in boxed policy seam.
3. Avoids behavior drift in app mode.

## Escape-Hatch Recheck (after run 3)
1. Preview-reachable runtime portals all flow through boxed policy.
2. Fullscreen-ish runtime menus/debug overlays remain boxed-disabled in `CanvasOverlays`.
3. Dev download branch remains boxed-disabled before `document.body.appendChild`.

## Verification
- Command: `npm run build`
- Result: pass.
