# Step 13 NodePopup Scale Run 3 - Clamp and Scroll Hardening
Date: 2026-02-16

## Clamp hardening
- File: `src/popup/NodePopup.tsx`
- Added a local safe clamp helper that guards invalid clamp ranges:
  - `safeMax = Math.max(min, max)`
- Updated popup position clamp to use safe helper for both left/top.

Why:
- In extreme small viewport cases, `maxLeft` or `maxTop` can become less than margin min.
- Safe clamp prevents unstable min/max behavior and keeps popup placement deterministic.

## Boxed clamp and viewport source check
- `computePopupPosition(...)` still uses boxed viewport path:
  - `isBoxedViewport(viewport)`
  - `getViewportSize(...)`
  - `toViewportLocalPoint(...)`
- No window clamp reintroduced for boxed mode.

## Scroll + wheel containment check
- Popup content still has `data-arnvoid-overlay-scrollable="1"` marker.
- Popup wheel capture still routes through `stopOverlayWheelPropagation`.
- `overscrollBehavior: 'contain'` remains on popup root and content styles.

## Result
- Boxed popup clamp behavior is more robust with no changes to app mode behavior.

## Verification
- Ran `npm run build`.
