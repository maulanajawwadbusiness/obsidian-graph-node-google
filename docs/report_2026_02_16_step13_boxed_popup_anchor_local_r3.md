# Step 13 Boxed Popup Anchor Local Run 3 - Clamp Path Verification
Date: 2026-02-16

## Verification scan
File: `src/popup/NodePopup.tsx`

### 1) Side-selection logic intact
- Popup horizontal side still decided by:
  - `if (anchorX > viewportWidth / 2) { left-of-node } else { right-of-node }`
- This means right-side dots can place popup left, left-side dots can place popup right.

### 2) Clamp logic intact
- Left clamp remains:
  - `minLeft = 10`
  - `maxLeft = viewportWidth - popupWidth - 10`
- Top clamp remains:
  - `minTop = 10`
  - `maxTop = viewportHeight - popupHeight - 10`

### 3) Boxed anchor conversion status
- No remaining boxed use of `toViewportLocalPoint(...)` in `NodePopup` anchor pipeline.
- Both sync paths feed local anchors into compute:
  - render-tick `detail.transform.worldToScreen(...)`
  - track-node fallback path

### 4) Expected behavior impact
- With double-subtraction removed, anchors no longer bias negative by viewport origin offset.
- Clamp should no longer collapse to `minLeft=10` for most nodes.

## Code patch status in this run
- No additional code change needed beyond runs 1-2; verification confirms path correctness.

## Verification
- Ran `npm run build`.
