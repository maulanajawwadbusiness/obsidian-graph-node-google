# Legacy LoadingScreen Suppression (2026-02-15)

## Scope
- Suppressed legacy runtime `LoadingScreen` for product AppShell graph-class flow.
- Kept loading callbacks/signals intact for gate state machine.
- Did not change analysis internals.

## Where Legacy Surface Lived
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- Legacy return path:
  - `if (isGraphLoading) return <LoadingScreen errorMessage={...} />`

## Suppression Mechanism
1. Added runtime switch on graph component props:
   - `legacyLoadingScreenMode?: 'enabled' | 'disabled'`
   - default remains `'enabled'` for safe rollout.
2. Guarded legacy return path:
   - only returns `LoadingScreen` when mode is `'enabled'`.
3. Product AppShell graph-class path now passes `'disabled'`.
4. Added compile-time contract map in render seam:
   - `LEGACY_LOADING_MODE_BY_SCREEN: Record<AppScreen, 'enabled' | 'disabled'>`
   - explicit: `graph_loading` and `graph` are `'disabled'`.

## Signal Integrity
- `onLoadingStateChange?.(isGraphLoading)` remains unchanged.
- `graphIsLoading` still propagates to AppShell gate logic.
- Warm-mount topology remains unchanged (no screen-based runtime keying added).

## Verification Notes
- `npm run build` passed after each run.
- Manual runtime verification recipe:
  1. Start app with `?debugWarmMount=1`.
  2. Submit prompt -> `graph_loading` gate appears.
  3. During loading, confirm legacy `LoadingScreen` no longer appears.
  4. Confirm appears when gate is done, then confirm -> graph.
  5. Toggle `graph_loading` <-> `graph` via debug hook and confirm mount id stability.
