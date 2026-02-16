# Step 13 NodePopup Scale Run 4 - Docs and Policy Rails
Date: 2026-02-16

## Dev instrumentation added
- File: `src/runtime/ui/boxedUiPolicy.ts`
- Added counter key:
  - `boxedNodePopupScaleAppliedCount`
- Added helper:
  - `recordBoxedNodePopupScaleApplied()`
- Included in debug snapshot output.

## NodePopup counter wiring
- File: `src/popup/NodePopup.tsx`
- In boxed mode when popup is open (`selectedNodeId` present and scale < 1), record one scale-application event.
- This is dev-only and quiet (no log spam).

## Docs update
- File: `docs/system.md`
- Added boxed NodePopup scale policy notes:
  - `BOXED_NODE_POPUP_SCALE` is policy-owned in `boxedUiPolicy`.
  - `NodePopup` uses boxed-only scale and scaled clamp dimensions.
  - graph screen/app mode remains unchanged.
- Added `boxedNodePopupScaleAppliedCount` to boxed policy counter list.

## Final grep audit
- `BOXED_NODE_POPUP_SCALE` usage is limited to:
  - `src/runtime/ui/boxedUiPolicy.ts`
  - `src/popup/NodePopup.tsx`
- No other popup surfaces were unintentionally scaled.

## Verification
- Ran `npm run build`.
