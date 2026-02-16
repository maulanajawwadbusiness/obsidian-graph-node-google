# Step 6 Wheel Guard Stabilization Report (Run 4)

Date: 2026-02-15
Focus: stabilize preview markers and seam ownership

## Marker Seams Centralized

Updated `src/components/sampleGraphPreviewSeams.ts`:
- added portal constants:
  - `SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_ATTR`
  - `SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_VALUE`
  - `SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR`
- added helper:
  - `isInsideSampleGraphPreviewPortalRoot(target)`
- hardened root helper target normalization for non-element targets.

## Consumers Updated

1. `src/components/SampleGraphPreview.tsx`
- preview portal root now uses centralized constants (no hardcoded attr string).
- root and portal markers remain stable whenever preview component is rendered.

2. `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- now uses seam helpers for both checks:
  - `isInsideSampleGraphPreviewRoot(...)`
  - `isInsideSampleGraphPreviewPortalRoot(...)`
- removed duplicated local selector logic.

## Structural Guarantee
- preview portal root remains inside preview root in component tree.
- this keeps closest()-based allowlist logic deterministic.
