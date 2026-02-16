# Step 13 NodePopup Anchor Fix Run 3 - Boxed Coordinate Rails
Date: 2026-02-16

## Coordinate-space validation rails
File: `src/popup/NodePopup.tsx`

Added a boxed-mode dev warn-once guard:
- `warnIfBoxedAnchorOutOfBounds(anchorX, anchorY, source)`
- Active only in dev and only in boxed mode.
- Converts candidate anchor coords to boxed-local using `toViewportLocalPoint(...)`.
- Compares against boxed viewport size from `getViewportSize(...)`.
- Warns once when anchor point falls outside a padded viewport envelope.

Hook points:
- render-tick path (primary)
- track-node fallback path

## Why
This catches regressions where anchor coordinates are accidentally in wrong space (window/global vs boxed-local assumptions), which causes apparent popup drift.

## Clamp and viewport correctness check
- Clamp path remains boxed-aware in `computePopupPosition(...)`.
- Boxed path still uses:
  - `isBoxedViewport(viewport)`
  - `toViewportLocalPoint(...)`
  - `getViewportSize(...)`
- No new window-dimension clamp path introduced for boxed mode.

## Verification
- Ran `npm run build`.
