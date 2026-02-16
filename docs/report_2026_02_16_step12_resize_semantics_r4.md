# Step 12 Resize Semantics Run 4 - Edge Cases And Invariants

Date: 2026-02-16

## Hardening changes

1. Boxed containment override to preserve intent:
   - `src/playground/GraphPhysicsPlaygroundShell.tsx`
   - introduced `effectiveCameraLocked = cameraLocked || isBoxedRuntime`.
   - passed `effectiveCameraLocked` into `useGraphRendering(...)`.
   - this blocks per-frame auto-fit containment in boxed runtime, preventing resize semantics from being overwritten.

2. First-real-measurement guard:
   - in boxed resize effect, if previous viewport size is tiny sentinel (`<=1`), update baseline and skip camera adjust.
   - avoids applying semantics from fallback/tiny initialization states.

3. NaN safety rail:
   - added dev warn-once guard before applying computed camera:
     - if computed pan/zoom is non-finite, skip apply and warn once.

4. UI state consistency:
   - passed `effectiveCameraLocked` to `CanvasOverlays` lock indicator prop.

## Why this matters

1. Ensures boxed resize semantics are authoritative and deterministic.
2. Prevents camera jumps from fallback measurement transitions.
3. Protects camera state from invalid math propagation.

## Verification
- Command: `npm run build`
- Result: pass.
