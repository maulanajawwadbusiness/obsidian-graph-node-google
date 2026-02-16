# Step 9 Boxed Viewport Run 2 - Core Boxed Clamp/Coord Fixes

Date: 2026-02-16
Run: r2
Scope: consume GraphViewport contract for boxed mode in key overlay clamp/position systems.

## New helper module

Added:
- `src/runtime/viewport/viewportMath.ts`

Utilities:
- `isBoxedViewport(viewport)`
- `getViewportSize(viewport, fallbackW, fallbackH)`
- `getViewportOrigin(viewport)`
- `toViewportLocalPoint(clientX, clientY, viewport)`
- `clampToViewport(value, contentSize, viewportSize, margin)`

Purpose:
- centralize boxed origin/size conversion and clamp behavior
- avoid repeating window/container math fragments

## Updated callsites

1. Tooltip clamp + origin
- `src/ui/tooltip/TooltipProvider.tsx`
- boxed path now uses:
  - viewport width/height from `useGraphViewport()`
  - local anchor conversion via viewport boundsRect origin
  - clamp via viewport helper
- app/container path remains behavior-compatible fallback.

2. Node popup position + clamp
- `src/popup/NodePopup.tsx`
- boxed path now uses GraphViewport for:
  - viewport width/height
  - anchor local coordinates
  - initial fallback height sizing
- app path continues using prior portal/window fallbacks.

3. Mini chatbar position + clamp
- `src/popup/MiniChatbar.tsx`
- boxed path now uses viewport size and viewport-origin local rect conversion.
- app path remains unchanged.

4. Chat shortage notification
- `src/popup/ChatShortageNotif.tsx`
- boxed path now uses viewport size/origin for local anchor clamp.
- app path retains existing portal/window fallback behavior.

## Explicit non-changes (intentional)

- camera containment logic not modified (already rect-based in runtime path).
- pointer->world transform not modified (already rect-origin normalized).
- lease/portal/wheel behavior unchanged.

## Build result

- `npm run build` passed.
