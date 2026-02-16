# Step 10 Wheel Bleed Fix Run 1

Date: 2026-02-16
Scope: forensic mapping and policy decision only

## Root cause seam (exact)

File: `src/components/SampleGraphPreview.tsx`

Current capture-wheel branch:
1. if target is inside `data-arnvoid-overlay-interactive="1"`:
   - skip `preventDefault()`
2. else:
   - call `preventDefault()`

This means overlay-marked zones can still page-scroll when no local scroll consumer exists.

## Overlay roots and markers (current)

Interactive roots with marker:
1. `src/popup/NodePopup.tsx` root (`id="arnvoid-node-popup"`)
2. `src/popup/MiniChatbar.tsx` chat root
3. `src/popup/ChatShortageNotif.tsx` notif root

Non-interactive/infra surfaces:
1. `src/ui/tooltip/TooltipProvider.tsx` tooltip layer/bubble uses `pointerEvents: 'none'` (not interactive)
2. `src/popup/PopupOverlayContainer.tsx` wrapper `pointerEvents: 'none'` (not interactive)

## Decision: scrollability-gated overlay pass-through

We will replace marker-only exception with scrollability-gated pass-through.

Helper signature (target seam):
- `findScrollableWheelConsumer(target, overlayRoot, deltaX, deltaY): HTMLElement | null`

Algorithm:
1. Convert `target` to element and walk ancestors up to `overlayRoot` boundary.
2. Candidate scrollable by axis if:
   - vertical: `overflowY` is `auto|scroll|overlay` and `scrollHeight > clientHeight`
   - horizontal: `overflowX` is `auto|scroll|overlay` and `scrollWidth > clientWidth`
3. Can-consume check by delta sign:
   - `deltaY > 0`: `scrollTop + clientHeight < scrollHeight`
   - `deltaY < 0`: `scrollTop > 0`
   - `deltaX > 0`: `scrollLeft + clientWidth < scrollWidth`
   - `deltaX < 0`: `scrollLeft > 0`
4. Return first consumer that can consume; else `null`.

Policy in preview wheel capture:
1. Non-overlay target: keep `preventDefault()`.
2. Overlay target:
   - consumer found: allow default for native overlay scroll.
   - no consumer: call `preventDefault()` (block page scroll bleed).

## Contract clarification

`useOnboardingWheelGuard` is a `window` capture listener and can still observe preview wheel events by DOM order.
The practical invariant is:
1. onboarding guard must never block preview wheel paths.
2. preview wheel must never scroll page.

## Run 1 verification

- `npm run build` executed after report.