# Step 8 Hardening Round 2 Run 3 - Mount Stabilization and Visibility Guard

Date: 2026-02-16
Run: r3
Scope: add startup stabilization burst and hidden-tab settle guard without introducing permanent loops.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Mount stabilization burst:
   - on target bind, starts settle tracking with 20 stable frames.
   - still bounded by existing global settle cap (`60`).
2. Visibility-safe settle:
   - settle continuation now stops when `document.visibilityState === 'hidden'`.
   - no further settle-scheduled frames while hidden.
3. Visibility change listener:
   - `document.visibilitychange` added.
   - when hidden: settle tracking is cleared.
   - when visible: one position refresh is scheduled.
4. `beginSettleTracking` now accepts explicit stable-frame count:
   - default remains 8.
   - mount path uses 20.

## Safety notes

- No permanent polling added.
- Cleanup removes visibility listener and keeps all prior cleanup invariants.

## Verification

- `npm run build` passes.
