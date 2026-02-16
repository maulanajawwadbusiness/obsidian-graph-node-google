# Step 11 Quickcheck Run 4 - Final Audit, Docs, And Counters

Date: 2026-02-16

## Final Audit Commands
1. `rg -n "createPortal\(" src/popup src/ui src/playground src/auth`
2. `rg -n "resolveBoxedPortalTarget\(|assertBoxedPortalTarget\(|countBoxedSurfaceDisabled\(" src/popup src/ui src/playground`
3. `rg -n "document.body.appendChild|document.body" src/playground src/components`
4. targeted `CanvasOverlays` boxed gating check (`!isBoxedRuntime` branches + forced-close effects).

## Audit Findings
1. Preview-reachable runtime portal surfaces are boxed-policy guarded:
   - `src/popup/PopupOverlayContainer.tsx`
   - `src/ui/tooltip/TooltipProvider.tsx`
   - `src/playground/components/AIActivityGlyph.tsx`
2. `createPortal(...)` also appears in `src/auth/LoginOverlay.tsx`, but this is AppShell auth overlay path, not preview runtime overlay surface.
3. `document.body.appendChild(anchor)` exists in `src/playground/GraphPhysicsPlaygroundShell.tsx`, but boxed path exits early and increments boxed-disable counter.
4. `CanvasOverlays` fullscreen-ish/menu/debug fixed-position surfaces remain gated off in boxed mode via `!isBoxedRuntime` and close-on-boxed effects.

## Docs Update
Updated `docs/system.md` Step 11 section:
1. added `assertBoxedPortalTarget(...)` seam note.
2. updated dev counters list with `boxedBodyPortalRedirectCount`.

## Acceptance Criteria Mapping
1. boxed mode no body portals:
   - satisfied for preview-reachable runtime portals via boxed policy guards.
2. fullscreen-ish UI disabled or contained in boxed:
   - satisfied for runtime overlay/menu/debug paths in `CanvasOverlays` and boxed dev-download block.
3. missing preview root disables safely + warn-once:
   - satisfied through `resolveBoxedPortalTarget(...) -> null` plus `countBoxedSurfaceDisabled(...)`, and dev warn-once invariants.
4. app mode unchanged:
   - no app-mode behavior branches changed in this quickcheck.

## Verification
- Command: `npm run build`
- Result: pass.
