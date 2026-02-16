# Step 13 Boxed Popup Anchor Local Run 2 - Debug Helper Alignment
Date: 2026-02-16

## Scope
Aligned boxed debug range checks to the new local-anchor contract.

## Change
File: `src/popup/NodePopup.tsx`

- `warnIfBoxedAnchorOutOfBounds(...)` now treats boxed anchor inputs as local coordinates directly.
- Removed boxed `toViewportLocalPoint(...)` usage from this helper.
- Range check now compares `anchorX/anchorY` directly against local `viewportWidth/viewportHeight`.

## Cleanup
- Removed now-unused `toViewportLocalPoint` import from `NodePopup.tsx`.

## Why
After run 1, compute path is local in boxed mode. Keeping extra conversion only in debug path would produce misleading warnings and obscure real regressions.

## Verification
- Ran `npm run build`.
