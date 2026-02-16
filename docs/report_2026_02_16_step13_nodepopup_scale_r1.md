# Step 13 NodePopup Scale Run 1 - Forensic Audit
Date: 2026-02-16

## Scope
Forensic scan only. No behavior changes.

## NodePopup measurement and clamp seams
- Clamp function: `src/popup/NodePopup.tsx:128` (`computePopupPosition`).
- Boxed viewport source:
  - `useGraphViewport` at `src/popup/NodePopup.tsx:191`
  - boxed math via `isBoxedViewport`, `getViewportSize`, `toViewportLocalPoint`.
- Initial positioning uses unscaled layout measurements:
  - `popupRef.current?.offsetWidth` at `src/popup/NodePopup.tsx:215`
  - `popupRef.current?.offsetHeight` at `src/popup/NodePopup.tsx:216`
- Render-tick sync also uses unscaled layout measurements:
  - `offsetWidth`/`offsetHeight` at `src/popup/NodePopup.tsx:384-385`
  - fallback path at `src/popup/NodePopup.tsx:416-417`

## Transform behavior today
- Popup visual transform animation:
  - hidden: `transform: 'scale(0.8)'` at `src/popup/NodePopup.tsx:74`
  - visible: `transform: 'scale(1)'` at `src/popup/NodePopup.tsx:82`
- Positioning updates set `transformOrigin` each tick (`src/popup/NodePopup.tsx:432,447`).

## Wheel + scroll containment seams
- Overlay wheel capture handler exists: `onWheelCapture={stopOverlayWheelPropagation}` (`src/popup/NodePopup.tsx:473`).
- Explicit scrollable marker exists on popup content:
  - `data-arnvoid-overlay-scrollable="1"` at `src/popup/NodePopup.tsx:493`.
- Popup content already sets `overscrollBehavior: 'contain'` (`src/popup/NodePopup.tsx:109`).

## Portal containment seams
- NodePopup mounts through `PopupOverlayContainer`.
- Boxed portal safety is already enforced in:
  - `src/popup/PopupOverlayContainer.tsx:51-67`
  - `src/runtime/ui/boxedUiPolicy.ts` (`resolveBoxedPortalTarget`, no body fallback in boxed).

## Decision
Chosen strategy: **B**.
- Because clamp and layout read paths use `offsetWidth/offsetHeight` (transform-unaware), pure CSS scale would desync visual size vs clamp math.
- Implement boxed scaling by:
  1) applying boxed-only CSS scale on NodePopup, and
  2) passing `offsetWidth * scale` / `offsetHeight * scale` into all `computePopupPosition(...)` paths.

This preserves current architecture and avoids portal/wheel policy regressions.
