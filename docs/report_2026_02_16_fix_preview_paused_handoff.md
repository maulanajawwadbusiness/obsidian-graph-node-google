# Fix Report: Preview Paused After Return Handoff (2026-02-16)

## Root Cause
Prompt preview could get stuck at `preview paused (active: graph-screen)` after `prompt -> graph -> prompt` due to a handoff race and retry gap:

- preview acquires in layout phase (`useLayoutEffect`)
- graph boundary released lease in passive cleanup (`useEffect` cleanup)
- preview retry relied on future lease notifications only

This allowed a one-time deny on return to prompt, then no guaranteed reacquire.

## Changes

### 1) Bedrock handoff timing
- File: `src/runtime/GraphRuntimeLeaseBoundary.tsx`
- Moved graph lease release to layout cleanup in the same layout effect that acquires.
- Release path now clears token before release for idempotent cleanup behavior.
- Passive unmount effect keeps resource-balance warning only.

### 2) Preview self-healing reacquire on mount
- File: `src/components/SampleGraphPreview.tsx`
- Added shared `tryAcquirePreviewLeaseFromSnapshot(...)` path used by lease subscriber.
- After subscription setup, preview now runs an immediate snapshot bootstrap using `getGraphRuntimeLeaseSnapshot()`.
- This removes dependence on future notify timing for first recovery.

### 3) Last-gap one-shot retry
- File: `src/components/SampleGraphPreview.tsx`
- When initial acquire is denied by `graph-screen`, schedule one rAF snapshot retry.
- One-shot only; no polling loop.
- rAF is canceled on unmount.

### 4) DEV-only bounded instrumentation
- Files:
  - `src/runtime/GraphRuntimeLeaseBoundary.tsx`
  - `src/components/SampleGraphPreview.tsx`
- Added low-noise counters/logs for:
  - graph layout cleanup release count
  - preview denied-by-graph count
  - reacquire attempts/success
  - snapshot bootstrap attempts/success
  - one-shot rAF retry attempts/success

## Verification

### Build
- Ran `npm run build` successfully.

### Manual repro checklist
1. Open prompt screen: preview runs.
2. Navigate prompt -> graph: preview may pause while graph owns lease.
3. Navigate graph -> prompt: preview resumes and is not stuck on `active: graph-screen`.
4. Repeat navigation multiple times; confirm deterministic release->acquire handoff.
