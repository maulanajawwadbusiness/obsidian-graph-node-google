# Step 10 Wheel Bleed Fix Run 2

Date: 2026-02-16
Scope: helper implementation + SampleGraphPreview wheel policy patch

## Added shared helper functions

File: `src/components/sampleGraphPreviewSeams.ts`

Added:
1. `findClosestOverlayInteractiveRoot(target)`
2. `findScrollableWheelConsumer({ target, overlayRoot, deltaX, deltaY })`
3. `shouldAllowOverlayWheelDefault({ target, deltaX, deltaY })`

Behavior:
- walks target ancestors up to overlay root boundary
- detects scrollability via overflow and scroll extents
- allows default wheel only if a candidate can consume delta direction

## Patched preview wheel capture policy

File: `src/components/SampleGraphPreview.tsx`

Changes:
1. replaced marker-only overlay exception with `shouldAllowOverlayWheelDefault(...)`.
2. if overlay can consume wheel: allow default.
3. otherwise: `preventDefault()` to block page scroll bleed.
4. non-overlay paths remain `preventDefault()`.

## Effect

- overlay pass-through is now scrollability-gated instead of marker-gated.
- non-scrollable overlay zones no longer leak wheel to page scroll fallback.

## Run 2 verification

- `npm run build` executed after changes.