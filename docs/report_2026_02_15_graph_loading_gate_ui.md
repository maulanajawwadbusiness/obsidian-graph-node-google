# Report: Graph Loading Gate UI (2026-02-15)

## Scope
Step 5 only.
- Implement real gate UI surface for `screen === 'graph_loading'`.
- No confirm behavior/latch yet.
- No changes to `GraphPhysicsPlaygroundShell` or `LoadingScreen`.
- No analysis trigger logic changes.

## Component Location + Structure
New component:
- `src/screens/appshell/render/GraphLoadingGate.tsx`

Mounted from:
- `src/screens/appshell/render/renderScreenContent.tsx`

Graph-class branch behavior:
- shared runtime subtree remains mounted (`GraphWithPending`)
- gate is additive and only rendered for `screen === 'graph_loading'`

## Shielding Implementation
`GraphLoadingGate` uses a hard input shield:
- `onPointerDownCapture`: stopPropagation
- `onPointerMoveCapture`: stopPropagation
- `onPointerUpCapture`: stopPropagation
- `onWheelCapture`: preventDefault + stopPropagation
- `onContextMenu`: preventDefault
- style `touchAction: 'none'`

This prevents pointer/wheel leakage to canvas while gate is present.

## Visual + Layering
Gate visual spec:
- full-cover absolute layer (`position:absolute; inset:0`)
- opaque background `#06060A`
- centered text `Loading...`
- bottom-center reserved confirm slot placeholder (non-interactive)

Layering rule:
- gate z-index is local to graph pane (above graph runtime content, below global AppShell overlays/modals)
- no fade/opacity transition on gate

## Sidebar Behavior Decision
For blank-screen feel:
- persistent sidebar is hidden while `screen === 'graph_loading'`
- implemented in `src/screens/AppShell.tsx` by setting:
  - `showPersistentSidebar = screen === 'prompt' || screen === 'graph'`

Rationale:
- product spec requests graph_loading to feel like a real blank screen surface.

## Warm-Mount Verification (Using Existing Step 4 Hook)
Use:
- `?debugWarmMount=1`
- `window.__arnvoid_setScreen('graph_loading' | 'graph')`

Expected:
- gate appears/disappears by screen
- no additional `graph_runtime_mounted` mountId log when toggling (no remount)

## Build Verification
Command used after each run:
- `npm run build`

Results:
- Run 1: pass
- Run 2: pass
- Run 3: pass

## Checklist Confirmation
- graph_loading shows full `#06060A` + `Loading...`: implemented.
- gate blocks pointer/wheel to canvas: implemented via capture handlers.
- no graph content visible through gate: opaque background + no transitions.
- warm-mount path preserved: runtime subtree remains shared/unkeyed.
- persistent sidebar hidden in graph_loading: implemented.
- no other behavior changes introduced in prohibited areas.
