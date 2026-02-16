# Step 10 Boxed Input Ownership Run 4

Date: 2026-02-16
Scope: portal containment and click-through hardening

## Changes

1. Hardened preview root containment styles in `src/components/SampleGraphPreview.tsx`.
- Added `overscrollBehavior: 'contain'`.
- Added `touchAction: 'none'`.

2. Added preview-root bubble shielding handlers.
- `onPointerDown={stopPropagation}`
- `onWheel={stopPropagation}`
- This blocks bubble-phase leaks from preview subtree to onboarding/page handlers while preserving runtime target handlers.

3. Preserved portal containment model.
- Preview portal root remains inside preview root.
- Portal root remains `pointerEvents: 'none'`.
- Interactive overlay children remain explicit `pointerEvents: 'auto'` owners.

## Why this closes run-4 target

1. Preview subtree now explicitly contains overscroll and touch-gesture escape paths.
2. Bubble-phase pointer/wheel leakage to parent onboarding shell is blocked at preview root boundary.
3. Existing boxed portal containment contract remains intact.

## Verification
- `npm run build` executed after changes.