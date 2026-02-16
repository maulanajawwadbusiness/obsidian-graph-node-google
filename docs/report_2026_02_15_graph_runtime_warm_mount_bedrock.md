# Report: Graph Runtime Warm Mount Bedrock (2026-02-15)

## Scope
Step 4 only.
- Keep graph runtime warm-mounted across `graph_loading <-> graph`.
- No loading gate UI.
- No confirm behavior.
- No changes to `GraphPhysicsPlaygroundShell` or `LoadingScreen`.
- No analysis trigger logic changes.

## Shared Graph-Class Branch
Primary seam:
- `src/screens/appshell/render/renderScreenContent.tsx`

Graph runtime now routes through a graph-class bucket contract:
- `SCREEN_RENDER_BUCKET: Record<AppScreen, 'onboarding' | 'graph_class'>`
- both `graph_loading` and `graph` map to `graph_class`

Shared branch returns the same subtree for both screens:
- `Suspense`
- `GraphScreenShell`
- `GraphWithPending`

## Instance Identity Guarantees
1. Graph-class screens share one render branch.
2. No React key in the graph runtime subtree is tied to `screen`.
3. Onboarding transition host is explicitly excluded for graph-class current/from screens in:
   - `src/screens/AppShell.tsx`

These constraints prevent screen-toggle remount for `graph_loading <-> graph`.

## DEV Verification Hook (?debugWarmMount=1)
### Runtime mount log
File:
- `src/playground/GraphPhysicsPlayground.tsx`

Behavior:
- DEV-only and query-gated by `?debugWarmMount=1`
- logs once on mount:
  - `[WarmMount] graph_runtime_mounted mountId=<id>`

### Screen toggle helper
File:
- `src/screens/AppShell.tsx`

Behavior:
- DEV-only and query-gated by `?debugWarmMount=1`
- exposes:
  - `window.__arnvoid_setScreen('graph_loading' | 'graph')`
- logs screen set events.

Manual verification:
1. Open app with `?debugWarmMount=1`.
2. Observe one mount log with a mountId.
3. Run in console:
   - `window.__arnvoid_setScreen('graph_loading')`
   - `window.__arnvoid_setScreen('graph')`
4. Confirm no new `graph_runtime_mounted` log appears and mountId does not change.

## Build Verification
Command used after each run:
- `npm run build`

Results:
- Run 1: pass
- Run 2: pass
- Run 3: pass

## Behavior Notes
- No loading gate UI added yet.
- No confirm behavior added yet.
- No changes in `GraphPhysicsPlaygroundShell` or `LoadingScreen`.
- No analysis triggering changes.
