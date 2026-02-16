# Step 8 Origin Fix Run 2 - Core Origin Source Fix

Date: 2026-02-16
Run: r2
Scope: fix viewport origin source in `useResizeObserverViewport` while preserving bounded rAF behavior.

## Changes

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. `boundsRect.left/top` source is now `getBoundingClientRect()`:
   - flush path reads active element BCR and builds viewport origin from `bcr.left/top`.
2. Size source remains observer-driven:
   - observer callback stores latest size from `entry.contentRect.width/height`.
   - flush uses this latest observer size, with BCR size fallback.
3. Hook keeps core invariants:
   - one pending rAF bound (`pendingRafIdRef`)
   - sameViewport guard unchanged and still compares rect including left/top
   - cleanup still cancels rAF and disconnects observer
4. Ref support improved:
   - flush resolves active element from `elementRef.current ?? latestTargetRef.current`.

## Why this addresses the bug

- origin is no longer derived from `contentRect.left/top`.
- boxed viewport consumers now receive `boundsRect` origin from actual viewport coordinates.

## Verification

- `npm run build` passes.
