# Report: Tooltip Layer Mount (2026-02-15)

## Scope
Step 1 foundation only for custom tooltip engine:
- add tooltip z-index token,
- add global provider and body portal mount,
- wire provider at AppShell root.

No tooltip UI, no positioning logic, no migration of `title=` usage in this run.

## Files changed
- `src/ui/layers.ts`
- `src/ui/tooltip/TooltipProvider.tsx`
- `src/screens/AppShell.tsx`

## Layer choice rationale
- Added `LAYER_TOOLTIP = 3450` in `src/ui/layers.ts`.
- Existing modal layers stop at `LAYER_MODAL_LOGOUT_CONFIRM = 3400`.
- Login overlay is `LAYER_OVERLAY_LOGIN = 5000`.
- `3450` places tooltip above modal stack but below login overlay, matching intended global visibility without outranking auth blockers.

## TooltipProvider mount location
- Mounted `TooltipProvider` in `src/screens/AppShell.tsx` as the outer wrapper around AppShell shell content.
- This location makes tooltip infrastructure global across:
  - sidebar layer,
  - main screen content,
  - modal layer.
- This avoids placing tooltip host inside graph/canvas containers that may have transforms, overflow, or input capture behavior.

## Portal styling rules
Tooltip portal host (`TooltipPortal`) renders to `document.body` with:
- `position: fixed`
- `inset: 0`
- `zIndex: LAYER_TOOLTIP`
- `pointerEvents: 'none'`

Why:
- fixed + inset provides a stable viewport coordinate space for future positioning.
- pointer-events none ensures tooltip layer never captures pointer or wheel input and never steals interaction from overlays or canvas.

## Notes
- Portal currently renders an empty host div only.
- This is intentional for Step 1 foundation.

