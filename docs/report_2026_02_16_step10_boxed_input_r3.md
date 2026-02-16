# Step 10 Boxed Input Ownership Run 3

Date: 2026-02-16
Scope: overlay interactive ownership and wheel exception path

## Changes

1. Added shared boxed-overlay interactive marker convention.
- File: `src/components/sampleGraphPreviewSeams.ts`
- Added constants:
  - `SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_ATTR`
  - `SAMPLE_GRAPH_PREVIEW_OVERLAY_INTERACTIVE_VALUE`
  - selector helper + `isInsideSampleGraphPreviewOverlayInteractiveRoot(...)`

2. Updated preview wheel capture guard to respect interactive overlay targets.
- File: `src/components/SampleGraphPreview.tsx`
- Behavior:
  - If wheel target is inside marked interactive overlay root: skip `preventDefault`.
  - Otherwise keep `preventDefault` to suppress page scroll bleed in preview scope.

3. Marked interactive overlay roots and added capture-phase shields.
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`

Per root:
- Added `data-arnvoid-overlay-interactive="1"` marker.
- Added `onPointerDownCapture={stopPropagation}`.
- Added `onWheelCapture={stopPropagation}`.
- Kept existing bubble handlers.

## Why this closes run-3 target

1. Interactive overlays now have explicit ownership contract and hard-shield capture handlers.
2. Preview wheel guard now allows overlay-local wheel behavior (for scrollable interactive overlays) while keeping non-overlay preview wheel default suppression.
3. Tooltip remains non-interactive (`pointerEvents: 'none'`) and is intentionally not marked.

## Verification
- `npm run build` executed after changes.