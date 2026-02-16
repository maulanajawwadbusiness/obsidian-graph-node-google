# Step 10 Boxed Input Ownership Run 1

Date: 2026-02-16
Scope: forensic map only, no behavior change

## Current input ownership map

1. Onboarding wheel guard
- File: `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- Behavior: capture-phase `window` wheel listener blocks wheel globally during onboarding except allowlist targets under preview root or preview portal root.

2. Preview runtime host
- File: `src/components/SampleGraphPreview.tsx`
- Current root/portal styles:
  - preview root: relative/hidden, no explicit wheel capture ownership.
  - preview portal root: `pointerEvents: 'none'` with absolute container semantics.
- Gap: no dedicated preview-scoped wheel preventDefault path for overlay-hit wheel events.

3. Popup overlay stack
- Files:
  - `src/popup/PopupOverlayContainer.tsx` (`pointerEvents: 'none'` wrapper)
  - `src/popup/NodePopup.tsx` (`pointerEvents: 'auto'` popup/backdrop with bubble handlers)
  - `src/popup/MiniChatbar.tsx` (`pointerEvents: 'auto'` with bubble handlers)
  - `src/popup/ChatShortageNotif.tsx` (`pointerEvents: 'auto'` with bubble handlers)
- Gap: ownership handlers are mostly bubble-phase (`onPointerDown`, `onWheel`) and not standardized as capture-phase hard shields on interactive roots.

4. Tooltip layer
- File: `src/ui/tooltip/TooltipProvider.tsx`
- Behavior: tooltip layer + bubble are `pointerEvents: 'none'` by design, so tooltip is non-interactive and should not be treated as an interactive overlay owner.

## Bleed points and conflicts

1. Wheel bleed risk over boxed overlays
- Overlay components stop propagation on wheel but do not call preventDefault.
- If wheel lands on an overlay surface above canvas, canvas wheel handler may not run and browser page scroll can still happen.

2. Missing preview-local wheel ownership guard
- Existing onboarding allowlist prevents global guard blocking preview, but there is no preview-local capture guard that always calls preventDefault for wheel within preview scope.

3. Pointer ownership is inconsistent on boxed interactive roots
- Bubble-phase stopPropagation exists, but capture-phase shielding is not standardized with a clear marker convention.

4. Portal containment model is mostly correct but missing contract rails
- Portal root is correctly boxed and non-interactive by default, but overlay interactive ownership convention is not explicit.

## Minimal implementation plan for runs 2-5

1. Add preview wheel capture guard in `SampleGraphPreview`
- Native listener on preview root with `{ capture: true, passive: false }`.
- Always `preventDefault` inside preview to suppress page scroll bleed.
- Do not force-stop propagation at preview root so runtime wheel handling still reaches canvas path.

2. Add interactive overlay marker convention
- New attribute: `data-arnvoid-overlay-interactive="1"`.
- Apply to interactive boxed overlay roots: NodePopup, MiniChatbar, ChatShortageNotif.

3. Add capture-phase overlay shielding
- Interactive roots add:
  - `onPointerDownCapture={(e) => e.stopPropagation()}`
  - `onWheelCapture={(e) => e.stopPropagation()}`
- Keep existing bubble handlers for compatibility.

4. Add preview root guardrails
- `overscrollBehavior: 'contain'`
- `touchAction: 'none'`
- `onPointerDown={(e) => e.stopPropagation()}` at preview root to stop bubble leaks to onboarding while preserving runtime handlers.

5. Add dev rails
- Counters for prevented wheel, overlay-marked wheel pass-through accounting, and pointer stop propagation.
- Warn-once in onboarding wheel guard if a wheel event from preview unexpectedly reaches blocked path.

## Run 1 verification
- `npm run build` executed after this report.