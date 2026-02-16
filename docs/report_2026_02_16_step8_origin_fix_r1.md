# Step 8 Origin Fix Run 1 - Forensic Pinpoint and Patch Plan

Date: 2026-02-16
Run: r1
Scope: pinpoint the origin bug in `useResizeObserverViewport` and lock the minimal patch plan.

## Current behavior (forensic)

File: `src/runtime/viewport/useResizeObserverViewport.ts`

1. Bounds rect is built from one `DOMRectReadOnly` input:
   - `toViewportRect(rect)` maps `left`, `top`, `width`, `height`.
   - `makeViewport(...)` calls `toViewportRect(rect)` and stores that as `boundsRect`.
2. On observer callback, the hook sets:
   - `latestRectRef.current = entry.contentRect`
3. In rAF flush, it builds viewport from that stored rect:
   - `makeViewport(options.mode, options.source, rect)`
4. Result:
   - after first observer event, `boundsRect.left/top` is taken from `contentRect.left/top`.

Why this is wrong:
- `contentRect.left/top` is content-box local coordinate space, not viewport origin.
- Step 9 boxed math reads `viewport.boundsRect.left/top` as viewport origin (`toViewportLocalPoint` path).
- wrong origin poisons tooltip/popup/chat clamp locality in boxed mode.

## Additional forensic notes

1. Multi-entry callback handling is currently weak:
   - callback selects `entries[0]` only.
2. Size source:
   - currently from `entry.contentRect.width/height` (no `contentBoxSize` branch).
3. Initial seed path differs from observer path:
   - initial seed uses `target.getBoundingClientRect()`
   - observer updates use `entry.contentRect`
4. `sameViewport` already compares full rect including `left/top`, so no comparator expansion is needed.

## Minimal patch plan (locked)

1. Origin source:
   - in flush, derive `left/top` from observed element `getBoundingClientRect()`.
2. Size source:
   - prefer ResizeObserver size (`contentBoxSize` or `contentRect.width/height`).
   - fallback to BCR width/height if observer size is unavailable.
3. Callback hardening:
   - choose the entry whose `target` matches active observed element if possible.
4. Ref swap and strictmode:
   - bind observer lifecycle to actual target element identity.
   - keep disposed guard and bounded one-rAF scheduling.
5. Tracker invariants:
   - keep existing tracker names and exact acquire/release symmetry.

## Verification

- `npm run build` passes (baseline for run 1).
