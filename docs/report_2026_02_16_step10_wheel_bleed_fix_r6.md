# Step 10 Wheel Bleed Fix Run 6

Date: 2026-02-16
Scope: dev rails (counters + regression warn alignment)

## Counters upgraded in SampleGraphPreview

File: `src/components/SampleGraphPreview.tsx`

Replaced wheel counters with explicit buckets:
1. `previewWheelPreventedNonOverlay`
2. `previewWheelAllowedScrollableOverlay`
3. `previewWheelPreventedNonScrollableOverlay`

Kept:
- `previewPointerStopPropagationCount`

## Counter branch mapping

1. overlay root exists + scroll consumer exists:
- increment `previewWheelAllowedScrollableOverlay`
- allow default (no preventDefault)

2. overlay root exists + no scroll consumer:
- increment `previewWheelPreventedNonScrollableOverlay`
- call `preventDefault()`

3. no overlay root:
- increment `previewWheelPreventedNonOverlay`
- call `preventDefault()`

## Warn-once regression rail

- existing onboarding warn-once remains active in `useOnboardingWheelGuard`:
  - warns once if preview-origin wheel reaches blocked path unexpectedly.

Note:
- direct page-scroll delta probe was not added to avoid noisy/perf-sensitive global listeners.

## Run 6 verification

- `npm run build` executed after changes.