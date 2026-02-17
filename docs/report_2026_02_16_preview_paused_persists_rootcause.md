# Preview Paused Persists Root Cause (2026-02-16)

## Primary Root Cause
Graph screen lease is re-acquired during unmount cleanup due to a re-entrancy race in `GraphRuntimeLeaseBoundary`.

The graph branch does unmount on `graph -> prompt`, but boundary cleanup releases the token and immediately receives its own lease update callback before unsubscribe cleanup runs. That callback reacquires `graph-screen`, leaving `activeOwner=graph-screen` stuck even after prompt is active.

## File:Line Proof
1. Graph screen is not kept alive on prompt render:
- `src/screens/AppShell.tsx:935`
  - `if (isGraphClassScreen(screen)) return false;` for onboarding layer host.
- `src/screens/AppShell.tsx:956`
  - Non-onboarding path renders only `renderScreenContentByScreen(screen)`.
- `src/screens/appshell/render/renderScreenContent.tsx:117`
  - Graph subtree renders only when `SCREEN_RENDER_BUCKET[screen] === 'graph_class'`.
- `src/screens/appshell/render/renderScreenContent.tsx:201`
  - Prompt path returns `EnterPrompt`.

2. Boundary unmount cleanup releases token:
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:52`
  - layout cleanup runs `releaseGraphRuntimeLease(token)`.

3. Release synchronously notifies subscribers:
- `src/runtime/graphRuntimeLease.ts:215`
  - `releaseGraphRuntimeLease` calls `notifyLeaseSubscribers()`.
- `src/runtime/graphRuntimeLease.ts:98`
  - subscriber callbacks run synchronously in the loop.

4. Boundary subscriber reacquires when token is missing:
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:75`
  - boundary subscribes to lease updates.
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:76`
  - reads `activeTokenRef.current`.
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:81`
  - if token missing/inactive, calls `acquireGraphRuntimeLease(owner, instanceId)`.
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:83`
  - on success, writes new token back.

This means unmount path can do: release -> notify -> boundary callback -> reacquire `graph-screen` before unsubscribe cleanup executes.

## Counters/Logs Interpretation
Dev logs/counters already in code are consistent with this race:
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:60`
  - `[GraphRuntimeLeaseBoundary] layout_release ...` can fire, yet lease still ends as graph-screen because reacquire runs after release inside same teardown cycle.
- `src/components/SampleGraphPreview.tsx:320`
  - denied counter for graph owner can continue rising.
- `src/components/SampleGraphPreview.tsx:462`
  - UI remains `preview paused (active: graph-screen)`.

So `layout_release` presence is not proof of successful handoff.

## Minimal Patch Plan
1. In `src/runtime/GraphRuntimeLeaseBoundary.tsx`, add an unmount/disposing guard ref (`isDisposingRef`).
2. Set the guard before calling `releaseGraphRuntimeLease(token)` in layout cleanup.
3. In subscription callback, early-return when disposing is true (never reacquire while unmounting).
4. Optional hardening: move subscription to `useLayoutEffect` so unsubscribe ordering is deterministic with layout cleanup.

## Verification Checklist
1. Start on prompt and verify preview mounts.
2. Go `prompt -> graph` and confirm preview loses lease.
3. Go `graph -> prompt` via sidebar and confirm preview resumes (no persistent `activeOwner=graph-screen`).
4. In dev logs, verify no stale `graph-screen` owner remains after prompt is active.
5. Repeat the cycle 5+ times; preview must always recover.
