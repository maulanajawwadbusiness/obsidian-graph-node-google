# Step 10 Boxed Input Ownership Run 2

Date: 2026-02-16
Scope: wheel ownership inside preview

## Changes

1. Added preview-root wheel capture guard in `src/components/SampleGraphPreview.tsx`.
- Listener: native `wheel` with `{ capture: true, passive: false }`.
- Guard condition: active only while preview runtime is mounted (`canMountRuntime`).
- Behavior: `event.preventDefault()` for all wheel events in preview root scope.

2. Added dev resource tracking for listener lifecycle.
- Tracker key: `graph-runtime.preview.wheel-capture-listener`.
- Acquire on listener attach, release on cleanup.

3. Cleanup and strictmode safety.
- `removeEventListener(..., true)` on effect cleanup.
- Tracker release always executed on cleanup.

## Why this closes run-2 target

1. Wheel inside preview now always suppresses browser page scroll default at preview boundary.
2. Graph screen app mode is unchanged because the logic exists only in `SampleGraphPreview`.
3. Listener lifecycle is explicit and balanced.

## Verification
- `npm run build` executed after changes.