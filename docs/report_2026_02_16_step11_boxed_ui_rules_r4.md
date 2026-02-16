# Step 11 Boxed UI Rules Run 4

Date: 2026-02-16
Scope: portal containment guardrails across remaining runtime surfaces

## Changes

1. `PopupOverlayContainer` guarded in boxed mode.
- File: `src/popup/PopupOverlayContainer.tsx`
- Uses boxed policy helper:
  - resolve safe portal target in boxed mode
  - assert no body portal
  - disable surface if no safe target (dev counter)

2. `TooltipProvider` portal guarded in boxed mode.
- File: `src/ui/tooltip/TooltipProvider.tsx`
- `TooltipPortal` now:
  - resolves safe portal target in boxed mode
  - asserts no body portal
  - disables tooltip portal if safe target missing (dev counter)

3. `AIActivityGlyph` portal guarded in boxed mode.
- File: `src/playground/components/AIActivityGlyph.tsx`
- boxed mode now:
  - resolves safe portal target
  - asserts no body portal
  - disables surface when safe target missing (dev counter)

## Guardrail behavior

1. If boxed and portal target is body, helper attempts redirect to preview portal root.
2. If redirect fails, affected surface returns `null` and increments `boxedSurfaceDisabledCount`.
3. Dev warn-once path remains centralized in boxed policy helper.

## Run 4 verification

- `npm run build` executed after changes.