# Step 11 Boxed UI Rules Run 2

Date: 2026-02-16
Scope: boxed UI policy primitive

## Added helper

File: `src/runtime/ui/boxedUiPolicy.ts`

Exports:
1. `isBoxedUi(viewport)`
2. `isContainerPortalMode(mode)`
3. `assertNoBodyPortalInBoxed(portalTarget, debugName)`
4. `resolveBoxedPortalTarget(portalTarget, debugName)`
5. `countBoxedSurfaceDisabled(debugName)`
6. `getBoxedUiPolicyDebugSnapshot()`

## Behavior

1. Dev warn-once if boxed runtime attempts to portal to `document.body`.
2. Body-portal attempts are counted with `boxedBodyPortalAttempts`.
3. If body portal is detected, helper attempts redirect to preview portal root selector.
4. If no safe target exists, caller can disable surface and count via `boxedSurfaceDisabledCount`.

## Notes

- Helper is tiny and dependency-light.
- Uses existing preview portal selector seam from `sampleGraphPreviewSeams`.
- No runtime behavior change yet until surfaces are wired in next runs.

## Run 2 verification

- `npm run build` executed after this change.