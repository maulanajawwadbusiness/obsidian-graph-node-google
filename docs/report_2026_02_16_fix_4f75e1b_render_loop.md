# Fix Report: Commit 4f75e1b Render Feedback Loop (2026-02-16)

## Scope
- Target regression commit: `4f75e1b`
- Goal: stop render feedback loop that made graph screen runtime feel inert while keeping gate error force-back policy.

## Root Cause
A feedback loop formed between AppShell and graph runtime status emitters:
1. AppShell passed inline callback props from `renderScreenContent` on each render.
2. `GraphPhysicsPlaygroundShell` status/loading effects depended on callback identity, so callback churn retriggered emits.
3. AppShell handlers always wrote state as new objects, including no-op updates.
4. Parent rerender recreated callback identity and repeated the cycle.

Result: render churn starved runtime interaction and made graph screen feel dead.

## Fix Implemented
### 1) Stable callback identity
- Moved runtime bridge handlers into `AppShell` using `React.useCallback`:
  - `handleGraphLoadingStateChange`
  - `handleGraphRuntimeStatusChange`

### 2) No-op state writes are ignored
- Loading bridge now returns previous state when `prev.isLoading === isLoading`.
- Runtime status bridge now returns previous state when both fields match:
  - `isLoading`
  - `aiErrorMessage`
- Added small field-level comparator: `hasSameRuntimeStatus(...)`.

### 3) Render bridge now passes stable handlers
- `renderScreenContent` no longer accepts `setGraphRuntimeStatus`.
- It now accepts and forwards stable handlers:
  - `onGraphLoadingStateChange`
  - `onGraphRuntimeStatusChange`

### 4) DEV-only churn observability
- Added DEV counters in `AppShell` for:
  - AppShell render count
  - runtime status emit count
  - runtime status no-op count
  - loading no-op count
- Logs are throttled (every 120 events) with `[RenderLoopGuard]` tag.

## Force-Back Error Policy
- Gate error policy and force-back behavior were not removed.
- Changes are limited to runtime status bridge stabilization and no-op suppression.

## Files Changed
- `src/screens/AppShell.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/playground/modules/graphPhysicsTypes.ts`

## Verification
### Static verification
- Confirmed no inline runtime-status/loading callbacks remain in `renderScreenContent`.
- Confirmed bridge handlers in `AppShell` are memoized and no-op guarded.

### Build verification
- Command run: `npm run build`
- Result: failed due to pre-existing TypeScript `TS6133` errors in unrelated files:
  - `src/physics/engine/debug.ts`
  - `src/runtime/graphRuntimeLease.ts`
- These failures are outside the touched fix surface.

### Manual runtime checklist
- Pending manual check in browser:
  - drag dots on graph screen
  - wheel zoom on graph screen
  - preview box still interactive
  - DEV counters do not explode while idle
