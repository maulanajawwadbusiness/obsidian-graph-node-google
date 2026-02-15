# Step 4 Lease-Loss Bug Fix Run 1: Forensic Pinpoint

Date: 2026-02-15
Scope: Prove current lease-loss failure mode and identify hook points.

## Current behavior map

1. Lease preempt occurs in runtime lease module
- `src/runtime/graphRuntimeLease.ts:77`
- `graph-screen` acquisition replaces active lease via `createLease(...)`.
- Old token is stale but no active push signal exists to mounted consumers.

2. Preview mount decision is one-time local state
- `src/components/SampleGraphPreview.tsx:185`
- preview acquires lease in `useLayoutEffect` on mount.
- `leaseState` is set once (`allowed` or `denied`) and later render uses that static state.
- runtime mount gate is `canMountRuntime` at `src/components/SampleGraphPreview.tsx:207`.

3. No post-mount lease ownership revalidation in preview
- `src/components/SampleGraphPreview.tsx` has no subscription/snapshot/token-active checks.
- if preview mounted with valid token and later got preempted, component does not self-unmount runtime.

4. Graph-screen path preempts correctly but does not force loser to stop
- `src/runtime/GraphRuntimeLeaseBoundary.tsx:33`
- graph boundary acquires `graph-screen` lease.
- `renderScreenContent` mounts boundary around graph runtime at `src/screens/appshell/render/renderScreenContent.tsx:101`.
- loser preview runtime can remain mounted if coexistence occurs briefly.

## Failure mode (3 bullets)

1. Preempted preview token becomes stale but preview runtime keeps rendering because no active-token enforcement.
2. Coexisting trees (StrictMode or transition overlap) can leave preview runtime alive without ownership.
3. Lease currently blocks future acquisitions but does not self-enforce stop on already-mounted loser.

## Hook points for lease-loss unmount fix

1. Lease module (`src/runtime/graphRuntimeLease.ts`): add snapshot/subscription/token-active API.
2. Preview component (`src/components/SampleGraphPreview.tsx`): subscribe and force unmount when token inactive.
3. Graph boundary (`src/runtime/GraphRuntimeLeaseBoundary.tsx`): optional defensive re-acquire if token unexpectedly inactive.

## Run 1 outcome

- Bug confirmed with exact mount + preempt path.
- Required seams identified for self-enforcing ownership implementation.