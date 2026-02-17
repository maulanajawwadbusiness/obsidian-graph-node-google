# Preview Paused After Return Scandissect (2026-02-16)

## Scope
Issue: prompt preview gets stuck on `preview paused (active: graph-screen)` after `prompt -> graph -> prompt`.

This report is forensic-only. No behavior changes were made.

## 1) Timeline: prompt -> graph -> prompt (lease events and counters)

### Prompt initial mount
1. `SampleGraphPreview` mounts and attempts lease in layout phase:
   - `acquireGraphRuntimeLease('prompt-preview', ...)`
   - file: `src/components/SampleGraphPreview.tsx:259-277`
2. If no owner, lease is created:
   - `leaseCounters.acquire += 1`
   - file: `src/runtime/graphRuntimeLease.ts:117-125`

### Prompt -> graph
3. Graph branch renders `GraphRuntimeLeaseBoundary owner="graph-screen"`:
   - file: `src/screens/appshell/render/renderScreenContent.tsx:122-125`
4. Boundary acquires lease in layout effect:
   - file: `src/runtime/GraphRuntimeLeaseBoundary.tsx:38-52`
5. Graph owner preempts non-graph owner by contract:
   - `owner === 'graph-screen'` always creates new lease; `preempt` counter increments when prior owner differs.
   - file: `src/runtime/graphRuntimeLease.ts:135-150`
6. Preview detects lost token via subscriber callback and transitions to paused:
   - file: `src/components/SampleGraphPreview.tsx:290-304`

### Graph -> prompt (regression seam)
7. AppShell switches screen to prompt; graph subtree is removed from render path:
   - graph branch only renders for `graph_loading|graph`
   - file: `src/screens/appshell/render/renderScreenContent.tsx:117-165`
8. Graph boundary releases lease only in passive cleanup (`useEffect` cleanup), not layout cleanup:
   - file: `src/runtime/GraphRuntimeLeaseBoundary.tsx:54-63`
   - release path increments `leaseCounters.release += 1`
   - file: `src/runtime/graphRuntimeLease.ts:205-216`
9. Prompt preview mounts and attempts lease in `useLayoutEffect` before passive cleanup release runs:
   - file: `src/components/SampleGraphPreview.tsx:259-277`
   - result can be denied with `activeOwner: graph-screen`.
10. Preview retry logic depends only on lease notifications and does not perform an initial snapshot-based retry:
   - subscribe callback only reacts on future notify events.
   - file: `src/components/SampleGraphPreview.tsx:290-334`
   - there is no immediate `getGraphRuntimeLeaseSnapshot()` check at mount.

Resulting stuck state:
- preview remains in `denied` phase with stale owner text when no further lease epoch event arrives after subscription setup.
- paused message shown from:
  - file: `src/components/SampleGraphPreview.tsx:413-416`

## 2) Verdict

### Is graph runtime still mounted after leaving graph?
Most likely no.

Evidence:
- Graph runtime branch is conditionally rendered only for graph-class screens and removed when `screen === 'prompt'`.
  - `src/screens/appshell/render/renderScreenContent.tsx:117-165`
- Graph boundary release exists and is tied to unmount cleanup.
  - `src/runtime/GraphRuntimeLeaseBoundary.tsx:54-63`

### Primary root cause
Not persistent mount, but release timing + retry contract mismatch:
- graph lease release is passive (`useEffect` cleanup),
- preview acquire is layout-phase (`useLayoutEffect`),
- preview retry is event-driven only (no immediate snapshot retry on subscribe start).

This creates a deterministic handoff gap where preview can be denied once and remain denied.

## 3) Exact file:line anchors

### Graph lease acquire
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:38-52`
- `src/runtime/graphRuntimeLease.ts:127-150`

### Graph lease release seam
- release call site on boundary unmount:
  - `src/runtime/GraphRuntimeLeaseBoundary.tsx:54-63`
- release implementation:
  - `src/runtime/graphRuntimeLease.ts:187-216`

### Preview acquire + paused gate
- initial acquire attempt:
  - `src/components/SampleGraphPreview.tsx:259-277`
- retry/subscription logic:
  - `src/components/SampleGraphPreview.tsx:290-334`
- paused/denied UI message:
  - `src/components/SampleGraphPreview.tsx:413-420`

## 4) Fix options (ranked, no implementation)

## Option 1 (Bedrock recommendation): make graph release synchronous at unmount boundary
- Move graph lease release to layout cleanup path (`useLayoutEffect` cleanup) in `GraphRuntimeLeaseBoundary`.
- Keep passive cleanup only for non-lease resource warnings if needed.
- Why safest:
  - aligns release phase with preview acquire phase,
  - eliminates ordering race at screen handoff,
  - keeps ownership contract local to graph owner boundary.

## Option 2: add immediate snapshot-based reacquire on preview subscription setup
- On preview mount/subscription effect, read current snapshot once and run same reacquire gate logic immediately (not only on notifications).
- Why useful:
  - robust to missed notify windows,
  - fixes stuck denied even if release happened just before subscribe.
- Risk:
  - patches symptom at preview side; lease timing race still exists.

## Option 3: explicit AppShell ownership orchestrator
- Centralize lease ownership in AppShell screen transitions:
  - graph-screen owns only during graph-class screens,
  - prompt-preview acquisition is triggered after graph release acknowledgment.
- Why strongest long-term contract:
  - deterministic by screen policy.
- Cost/risk:
  - broader refactor; touches orchestration seams and likely more surfaces.

## Recommended path
1. Option 1 first (bedrock release timing fix).
2. Option 2 as hardening guard (immediate snapshot reacquire) to prevent future missed-event stalls.
3. Reserve Option 3 for larger architecture pass only if needed.
