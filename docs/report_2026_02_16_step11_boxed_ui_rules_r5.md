# Step 11 Boxed UI Rules Run 5

Date: 2026-02-16
Scope: final docs contract + counter rails + final audit

## Surfaces updated in Step 11

Contained by boxed policy:
1. `src/popup/PopupOverlayContainer.tsx` (portal target guard + disable-safe fallback)
2. `src/ui/tooltip/TooltipProvider.tsx` (portal target guard + disable-safe fallback)
3. `src/playground/components/AIActivityGlyph.tsx` (portal target guard + disable-safe fallback)

Disabled in boxed mode:
1. `src/playground/components/CanvasOverlays.tsx`
   - dots menu branch
   - fullscreen action path
   - debug overlay branch
   - dev download button branch
2. `src/playground/GraphPhysicsPlaygroundShell.tsx`
   - dev JSON export callback path that appends anchor to `document.body`

## Docs update

- Updated `docs/system.md` with Step 11 boxed-only UI contract:
  - boxed mode must avoid `document.body` portal targets
  - boxed mode must avoid fullscreen/window-assumption overlay branches
  - boxed mode must disable unsafe surfaces when local containment is not guaranteed
  - app mode unchanged requirement
  - PR checklist for future runtime overlays

## Dev rails

Policy helper counters in `src/runtime/ui/boxedUiPolicy.ts`:
1. `boxedBodyPortalAttempts`
2. `boxedSurfaceDisabledCount`

Warn-once behavior:
- body portal attempt in boxed mode emits one dev warning per surface key.

## Acceptance criteria mapping

1. In boxed mode, no runtime overlay escape path remains through fullscreen menu/debug fixed overlay branches.
2. Boxed portal surfaces now guard body target and fallback-disable if safe target missing.
3. Fullscreen-like branches in runtime path are disabled or local-contained.
4. App mode logic and render branches remain unchanged.

## Run 5 verification

- `npm run build` executed after changes.