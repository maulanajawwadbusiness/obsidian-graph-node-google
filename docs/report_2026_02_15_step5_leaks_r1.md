# Step 5 Leak Inventory Report (Run 1)

Date: 2026-02-15
Scope: Graph runtime mount/unmount lifecycle only (shared by preview and graph screen)

## Runtime Chain Scanned
- `src/components/SampleGraphPreview.tsx`
- `src/runtime/GraphRuntimeLeaseBoundary.tsx`
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `src/playground/rendering/graphRenderingLoop.ts`

## Resource Inventory Table

| Resource type | File:line | Created in | Expected cleanup | Current status |
|---|---|---|---|---|
| `window` event listener (`blur`) | `src/playground/rendering/graphRenderingLoop.ts:581` | `startGraphRenderLoop` | `window.removeEventListener('blur', handleBlur)` | OK (`:645`) |
| `canvas` event listener (`wheel`) | `src/playground/rendering/graphRenderingLoop.ts:631` | `startGraphRenderLoop` | `canvas.removeEventListener('wheel', handleWheel)` | MISSING |
| `requestAnimationFrame` loop | `src/playground/rendering/graphRenderingLoop.ts:633` | `startGraphRenderLoop` | `cancelAnimationFrame(frameId)` | OK (`:647`) |
| `document.fonts.ready.then(...)` async callback | `src/playground/rendering/graphRenderingLoop.ts:640` | `startGraphRenderLoop` | post-unmount guard/no-op | SUSPECT (no dispose guard) |
| `document.fonts` listener (`loadingdone`) | `src/playground/rendering/graphRenderingLoop.ts:641` | `startGraphRenderLoop` | `document.fonts.removeEventListener('loadingdone', handleFontLoad)` | MISSING |
| `ResizeObserver` | `src/playground/GraphPhysicsPlaygroundShell.tsx:289` | `useLayoutEffect` | `ro.disconnect()` | OK (`:292`) |
| `window` event listener (`blur`) | `src/playground/GraphPhysicsPlaygroundShell.tsx:520` | `useEffect` | remove in cleanup | OK (`:521`) |
| `window` event listener (`keydown`, capture) | `src/playground/GraphPhysicsPlaygroundShell.tsx:549` | `useEffect` | remove in cleanup | OK (`:550`) |
| lease subscription | `src/components/SampleGraphPreview.tsx:244` | `useEffect` | unsubscribe via returned function | OK (effect returns subscription cleanup) |
| lease token ownership | `src/components/SampleGraphPreview.tsx:238` | mount/unmount lifecycle | `releaseGraphRuntimeLease(token)` | OK (token release on unmount) |
| lease subscription | `src/runtime/GraphRuntimeLeaseBoundary.tsx:63` | `useEffect` | unsubscribe via returned function | OK |
| lease token ownership | `src/runtime/GraphRuntimeLeaseBoundary.tsx:57` | mount/unmount lifecycle | `releaseGraphRuntimeLease(token)` | OK |

## Current Gate Coverage
- Lease ownership is already self-enforcing from Step 4.
- Runtime mount gating is already fail-closed in preview.
- Remaining risk is low-level resource teardown inside shared rendering loop.

## Top 3 Highest-Risk Items To Patch In Runs 2-4
1. Missing `canvas.removeEventListener('wheel', handleWheel)` in `graphRenderingLoop` cleanup.
2. Missing `document.fonts.removeEventListener('loadingdone', handleFontLoad)` plus no post-unmount guard for `document.fonts.ready.then(...)` callback.
3. Missing reusable, dev-only resource balance instrumentation in runtime path (to detect future regressions quickly).

## Notes
- No behavior changes in this run.
- This run is forensic only and sets exact patch targets for runs 2-4.
