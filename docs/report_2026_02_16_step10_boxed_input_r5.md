# Step 10 Boxed Input Ownership Run 5

Date: 2026-02-16
Scope: dev rails, docs contract, final audit

## Changes

1. Added dev-only non-spam counters in preview ownership seam.
- File: `src/components/SampleGraphPreview.tsx`
- Counters:
  - `previewWheelPreventedCount`
  - `previewWheelOverlayPassThroughCount`
  - `previewPointerStopPropagationCount`
- Behavior:
  - incremented only in DEV.
  - no periodic console spam.

2. Added onboarding guard warn-once rail for preview mismatch path.
- File: `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- Added dev warn-once:
  - `"[OnboardingGesture] preview wheel reached blocked guard path"`
- Trigger condition:
  - blocked branch entered while `event.composedPath()` contains preview root or preview portal root selectors.

3. Updated system contract docs for Step 10.
- File: `docs/system.md`
- Added section:
  - `Step 10 boxed input ownership (2026-02-16)`
- Documented:
  - preview root wheel ownership guard
  - overlay interactive marker convention `data-arnvoid-overlay-interactive="1"`
  - capture-phase input shield rules
  - portal containment rules
  - dev counter/warn rails
  - extra verification checklist items

## Audit snapshots

1. Overlay interactive marker present and documented:
- `src/components/sampleGraphPreviewSeams.ts`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`
- `docs/system.md`

2. Capture-phase overlay shields present:
- `onPointerDownCapture={stopPropagation}` in all three interactive overlay roots.
- `onWheelCapture={stopPropagation}` in all three interactive overlay roots.

3. Dev rails present:
- counters in `SampleGraphPreview`
- warn-once rail in onboarding wheel guard

## Final acceptance mapping (Step 10)

1. Wheel inside preview: page-scroll default suppressed by preview wheel capture guard; graph/overlay ownership preserved.
2. Wheel outside preview: onboarding wheel guard behavior unchanged.
3. Drag/pointer inside preview: runtime target handlers still execute; preview root bubble stop prevents upstream leak.
4. Interactive overlays own pointer/wheel via explicit marker + capture shields.
5. Click-through prevention: boxed portal containment model preserved with explicit pointer ownership boundaries.

## Verification
- `npm run build` executed after changes.