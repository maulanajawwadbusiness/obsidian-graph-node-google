# Step 13 NodePopup Scale Run 2 - Boxed-Only Scale Implementation
Date: 2026-02-16

## Changes

### 1) Single source of truth for boxed popup scale
- File: `src/runtime/ui/boxedUiPolicy.ts`
- Added policy constant:
  - `BOXED_NODE_POPUP_SCALE = 0.4`

### 2) Boxed-only scale applied in NodePopup
- File: `src/popup/NodePopup.tsx`
- Imported policy constant and derived:
  - `popupScale = isBoxedViewport(viewport) ? BOXED_NODE_POPUP_SCALE : 1`
- Applied visual scale in final style transform:
  - hidden state: `scale(0.8) scale(popupScale)`
  - visible state: `scale(1) scale(popupScale)`
- App mode is unchanged because `popupScale = 1`.

### 3) Clamp math now uses scaled size
To avoid transform/clamp mismatch, all clamp inputs now use scaled layout dimensions:
- Initial paint `computePopupPosition(...)`:
  - width = `offsetWidth * popupScale`
  - height = `offsetHeight * popupScale` (or fallback height, then scaled)
- Render-tick sync path:
  - width = `offsetWidth * popupScale`
  - height = `offsetHeight * popupScale`
- Fallback track-node path uses the same scaled dimensions.

## Why this is correct
- Current NodePopup clamp path is offset-based (transform-unaware), so pure CSS scale would desync visual size from clamp boundaries.
- Scaling both visual transform and clamp dimensions keeps boxed popup contained and avoids oversized clipping behavior.

## Verification
- Ran `npm run build`.
