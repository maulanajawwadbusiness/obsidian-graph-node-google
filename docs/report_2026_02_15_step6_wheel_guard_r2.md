# Step 6 Wheel Guard Fix Report (Run 2)

Date: 2026-02-15
Focus: core allowlist gating in onboarding wheel guard

## Changed File
- `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`

## Behavior Change
Added preview allowlist early-return before global preventDefault path:
- allow when event target is inside preview root via:
  - `isInsideSampleGraphPreviewRoot(event.target)`
- allow when event target is inside preview portal root via:
  - `target.closest('[data-arnvoid-preview-portal-root="1"]')`

For allowlist matches:
- handler returns early
- no `preventDefault`
- no propagation blocking

For all non-allowlist targets:
- existing behavior unchanged (`event.preventDefault()` still applies)

## Compatibility
- onboarding guard remains active globally on onboarding screens
- graph runtime on preview can now receive wheel events in allowed scope
- no changes to lease/portal/data pipeline logic
