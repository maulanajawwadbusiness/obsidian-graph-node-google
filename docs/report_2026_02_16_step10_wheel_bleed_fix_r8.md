# Step 10 Wheel Bleed Fix Run 8

Date: 2026-02-16
Scope: docs update + final audit

## Docs updated

File: `docs/system.md`

Step 10 contract now explicitly states:
1. wheel pass-through for overlays is scrollability-gated, not marker-gated.
2. page scroll is forbidden for wheel events started inside preview.
3. optional explicit scroll marker is supported:
   - `data-arnvoid-overlay-scrollable="1"`
4. dev counters renamed to wheel-safety buckets:
   - `previewWheelPreventedNonOverlay`
   - `previewWheelAllowedScrollableOverlay`
   - `previewWheelPreventedNonScrollableOverlay`

## Final audit checks

1. Marker-only skip path removed.
- grep for marker-only early-return without scrollability check returned no matches.

2. Overlay wheels now gated by consumer detection in:
- `src/components/SampleGraphPreview.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`

## Manual verification checklist

1. Wheel on preview canvas: graph zoom/pan works, page does not scroll.
2. Wheel inside MiniChat messages: list scrolls; page does not scroll.
3. Wheel on NodePopup non-scroll zones (header/margins): no local scroll, page does not scroll.
4. Wheel on ChatShortageNotif: no local scroll, page does not scroll.
5. Wheel outside preview during onboarding: existing onboarding guard behavior unchanged.
6. Reopen prompt/preview multiple times: no duplicate listener behavior or post-unmount wheel effects.

## Run 8 verification

- `npm run build` executed after docs + final audit.