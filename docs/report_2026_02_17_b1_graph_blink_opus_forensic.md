# B1 Graph Blink — Forensic Root Cause Report

**Date**: 2026-02-17  
**Investigator**: Claude Opus  
**Status**: Forensic scan complete, root cause identified with high confidence  

---

## 1. Reproduction Steps

1. Start from the **prompt screen** with at least one saved interface in the sidebar
2. Click a saved interface in the sidebar (or via search overlay)
3. Observe: nav-restore fade overlay appears (black, 200ms fade-in)
4. Observe: when fade exits → **graph appears, disappears for 1-2 frames, then re-appears**

---

## 2. Observed Timeline

| Time | Event | Source |
|------|-------|--------|
| t₀ | User clicks saved interface | Sidebar click handler |
| t₀ | `startNavRestoreFade(id, 'sidebar')` fires | [AppShell.tsx:862](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L862) |
| t₀ | `setScreen('graph')` fires (instant, no animation) | [useOnboardingTransition.ts:91-92](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/useOnboardingTransition.ts#L91-L92) |
| t₀ | `setGraphLeasePhase('checking')` — **AppShell-level reset** | [AppShell.tsx:679-680](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L679-L680) |
| t₁ (next render) | `renderScreenContent` switches from EnterPrompt to graph tree | [renderScreenContent.tsx:123-177](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx#L123-L177) |
| t₁ | `GraphRuntimeLeaseBoundary` **mounts fresh** → initial state: `{ phase: 'checking' }` → renders `pendingFallback` | [GraphRuntimeLeaseBoundary.tsx:38](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/runtime/GraphRuntimeLeaseBoundary.tsx#L38) |
| t₁ commit | `useLayoutEffect` fires → lease acquired → `setLeaseState('allowed')` | [GraphRuntimeLeaseBoundary.tsx:48-55](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/runtime/GraphRuntimeLeaseBoundary.tsx#L48-L55) |
| t₁ commit (dev StrictMode) | `useLayoutEffect` cleanup fires → **lease released** → then re-fires → re-acquires | StrictMode double-invoke |
| t₂ (render after lease) | Graph children mount. `engine.clear()` + re-add nodes during restore effect | [GraphPhysicsPlaygroundShell.tsx:1135-1138](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1135-L1138) |
| t₂ + rAF | `onPendingLoadInterfaceApplied` fires, setting `navRestoreRestoreAppliedEpoch` | [GraphPhysicsPlaygroundShell.tsx:1153-1170](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1153-L1170) |
| t₀ + 200ms | `minDone=true` fires | [AppShell.tsx:1033-1051](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1033-L1051) |
| t₀ + ~200ms | `ready=true` latched (when lease=allowed AND restoreApplied match) | [AppShell.tsx:1082-1097](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1082-L1097) |
| t₀ + ~200ms | `phase='exiting'` → **overlay opacity target = 0** (CSS transition over 200ms) | [AppShell.tsx:1206-1269](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1206-L1269) |
| t₀ + ~400ms | `active=false` commit → **overlay unmounts** | [AppShell.tsx:1278-1314](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1278-L1314) |

All of bars t₁ through t₂ happen UNDER the opaque overlay (good). The question is: **why a blink after the overlay starts fading out?**

---

## 3. Root Cause Mechanism

> [!CAUTION]
> The blink is a **compound issue** with a primary cause and two amplifiers.

### Primary Cause: React StrictMode double-effect on `GraphRuntimeLeaseBoundary`

**Classification: (a) React remount/unmount — StrictMode-amplified lease boundary phase flip**

In dev mode, React StrictMode double-invokes `useLayoutEffect`:

1. **First invoke**: `acquireGraphRuntimeLease('graph-screen', ...)` → succeeds → `setLeaseState({ phase: 'allowed', ... })` → graph children render
2. **Cleanup**: `releaseGraphRuntimeLease(token)` → lease freed
3. **Second invoke**: `acquireGraphRuntimeLease('graph-screen', ...)` → succeeds → `setLeaseState({ phase: 'allowed', ... })`

Between steps 2 and 3, the lease state transiently becomes invalid. The subscriber effect also double-fires. The result is that the boundary briefly renders `pendingFallback` between the cleanup and re-acquisition, causing the graph children subtree to **unmount then remount**.

**Evidence**: [GraphRuntimeLeaseBoundary.tsx:46-78](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/runtime/GraphRuntimeLeaseBoundary.tsx#L46-L78) — the `useLayoutEffect` has acquire/release logic with no StrictMode guard. The existing `isDisposingRef` at line 47 attempts to mitigate subscriber firing during dispose, but does NOT prevent the complete unmount-remount of children during the double-invoke cycle.

**Why this manifests as a visible blink**: The nav-restore fade exit phase starts when `ready=true` AND `minDone=true`. The `ready` latch requires `graphLeasePhase === 'allowed'` — which settles after the StrictMode double-invoke. But the fade exit has already begun (opacity transitioning from 1 → 0). The graph canvas **re-mounts** during or just before the fade exit becomes transparent enough to see through, causing:

1. **Frame N**: Graph canvas visible (after first lease acquire)
2. **Frame N+1**: Graph canvas gone (lease released + children unmounted)
3. **Frame N+2**: Graph canvas back (re-acquired)

If the fade overlay is already partially transparent at this point, the user sees the blink.

### Amplifier 1: `engine.clear()` during restore

At [GraphPhysicsPlaygroundShell.tsx:1135](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1135), the restore path calls:

```typescript
engineRef.current.clear();        // ← all nodes destroyed
restoredNodes.forEach(n => engineRef.current.addNode(n));
physicsLinks.forEach(l => engineRef.current.addLink(l));
engineRef.current.resetLifecycle();
```

If the canvas render loop reads `engine.nodes` between `clear()` and `addNode()` (same frame, different microtask or rAF), the canvas shows an empty graph for 1 frame. In dev mode StrictMode, the effect running `clear()` also runs twice, doubling the window of exposure.

### Amplifier 2: `requestAnimationFrame`-deferred restore signal

At [GraphPhysicsPlaygroundShell.tsx:1153](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1153):

```typescript
window.requestAnimationFrame(() => {
    // ...deduplication check...
    onPendingLoadInterfaceApplied?.({ id: rec.id, navRestoreEpoch });
});
```

This defers the "restore applied" signal by **at least 1 frame** after the restore completes. The nav-restore fade `ready` latch at [AppShell.tsx:1082-1097](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1082-L1097) requires `navRestoreRestoreAppliedEpoch === navRestoreFade.epoch`. The rAF delay means `ready` is always at least 1 frame late, potentially allowing `timedOut` (1800ms) to unlock the fade exit before the graph is truly ready.

---

## 4. Why the Prior "Lease + RestoreApplied Latch" Fix Didn't Work

The attempted fix in the `latchNavRestoreRevealReady` mechanism:

```typescript
// AppShell.tsx:1082-1097
if (!navRestoreFade.active) return;
if (navRestoreFade.ready) return;
if (screen !== 'graph') return;
if (graphLeasePhase !== 'allowed') return;
if (navRestoreRestoreAppliedEpoch !== navRestoreFade.epoch) return;
latchNavRestoreRevealReady(navRestoreFade.epoch, 'lease_ready_and_restore_applied');
```

This correctly gates the fade exit on `graphLeasePhase === 'allowed'` AND restore-applied epoch match. **However, this only controls WHEN the fade exit STARTS**. The problem is:

1. **The `graphLeasePhase` checked is AppShell's state copy** — separate from the `GraphRuntimeLeaseBoundary`'s internal `leaseState`. AppShell's copy can be `'allowed'` while the boundary is in the middle of a StrictMode double-invoke cycle, causing the boundary to briefly unmount children.

2. **The fade exit is a 200ms CSS transition**, not a hard cut. During those 200ms, any lease boundary state flip (from StrictMode or subscriber re-fire) will cause the graph to blink at partial overlay opacity where it's visible.

3. **The rAF-deferred `onPendingLoadInterfaceApplied`** means the signal arrives 1-2 frames AFTER the restore is done. The reveal latch fires correctly — but by then, StrictMode has already caused its double-invoke cycle. The fix gates the *start* of the reveal, but not the *stability* of what's behind the overlay during the reveal transition.

> [!IMPORTANT]
> **Key insight**: The fix protects the wrong timeline window. It ensures the fade doesn't exit too early (before restore), but doesn't ensure the graph subtree remains stable (no remount/blink) during the 200ms fade-out transition.

---

## 5. Candidate Fix Strategies

### Strategy A: Prevent lease boundary `pendingFallback` flash (Minimal, Highest Safety)

**Approach**: Do not render `pendingFallback` during nav-restore flow. Instead, always render children and let the lease boundary be a transparent gate.

**Mechanism**: Either:
- (A1) Pass `pendingFallback={null}` when `navRestoreEpoch` is active, so `checking` phase renders empty fragment `<></>` instead of the "Starting graph runtime..." text
- (A2) Change `GraphRuntimeLeaseBoundary` to always render children (not swap subtrees based on phase) and use the `onLeaseStateChange` callback purely for signaling

**Risk**: Low. The nav-restore fade overlay already covers the screen during the checking phase, so the pendingFallback was never visible anyway. Rendering children "early" (before lease confirmed) avoids the unmount-remount cycle entirely.

**Lines to change**: 
- [renderScreenContent.tsx:130](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx#L130) — conditionally null `pendingFallback`

### Strategy B: Synchronous restore signal (remove rAF deferral)

**Approach**: Remove the `requestAnimationFrame` wrapper around `onPendingLoadInterfaceApplied` at [GraphPhysicsPlaygroundShell.tsx:1153](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1153).

**Mechanism**: Fire the restore-applied signal synchronously right after `engineRef.current.resetLifecycle()`. This makes the `ready` latch fire in the same render cycle as the restore, tightening the reveal timing.

**Risk**: Medium. The rAF was added as a deduplication mechanism (the `signalToken` guard). Need to verify the dedup still works without rAF. The rAF also ensures the restore has "settled" visually — removing it may introduce a 1-frame flash of pre-layout graph if the physics engine hasn't run its first tick.

**Lines to change**:
- [GraphPhysicsPlaygroundShell.tsx:1153-1171](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1153-L1171) — inline the callback

### Strategy C: Lock-on-reveal — freeze graph subtree identity during fade exit

**Approach**: During the `exiting` phase (200ms fade-out), prevent any state updates that would cause graph subtree re-renders. Specifically, suppress or memoize the lease boundary's internal state transitions during this window.

**Mechanism**: Pass a `suppressPhaseTransitions` prop to `GraphRuntimeLeaseBoundary` that, when true, skips `setLeaseState` calls. Set this to `true` during `navRestoreFade.phase === 'exiting'`.

**Risk**: Medium-High. Suppressing state updates is fragile and could mask real lease conflicts. Would need careful epoch-guarding to avoid stale suppression across nav events.

**Lines to change**:
- [GraphRuntimeLeaseBoundary.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/runtime/GraphRuntimeLeaseBoundary.tsx) — add prop and guard
- [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) — wire prop through
- [renderScreenContent.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx) — pass prop

### Strategy Ranking

| Rank | Strategy | Safety | Diff Size | Confidence |
|------|----------|--------|-----------|------------|
| 1 | **A** (null pendingFallback) | ★★★★★ | ~3 lines | High — eliminates the subtree swap entirely |
| 2 | **B** (sync signal) | ★★★★☆ | ~10 lines | Medium-High — tightens timing but doesn't eliminate root cause |
| 3 | **C** (freeze during exit) | ★★★☆☆ | ~25 lines | Medium — defensive but complex, risk of masking bugs |

> [!TIP]
> **Recommended**: Apply Strategy A first. If blink persists in dev-only (from StrictMode canvas remount via the Suspense boundary), combine with Strategy B for a complete fix.

---

## 6. Dev-Only vs Production

| Behavior | Dev (StrictMode) | Production |
|----------|-----------------|------------|
| Lease boundary double-invoke | ✅ Yes — causes unmount/remount | ❌ No — single invoke |
| `engine.clear()` blank frame | ✅ Possible (doubled) | ✅ Possible (single) |
| rAF signal delay | ✅ 1 frame delay | ✅ 1 frame delay |
| **Visible blink** | ✅ **Very likely** | ⚠️ **Possible but tighter window** |

> [!WARNING]
> The blink is **amplified in dev** by StrictMode's double-invoke of `useLayoutEffect` in `GraphRuntimeLeaseBoundary`, but the fundamental architectural issue (pendingFallback swapping out the graph subtree during a fresh mount) exists in **both dev and prod**. In prod, the window is ~1 frame for the `checking → allowed` transition vs ~3 frames in dev (double-invoke cycle). Whether it's visible in prod depends on frame timing and monitor refresh rate.

To confirm prod behavior: build with `npm run build` and serve the dist — if the blink disappears, it's pure StrictMode. If it persists (even briefly), it's the architectural issue.

---

## Appendix: File Reference Summary

| File | Role | Key Lines |
|------|------|-----------|
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) | Screen router, nav-restore fade state machine | 679-680, 862, 1082-1097, 1206-1269, 1658-1664, 1795-1817 |
| [renderScreenContent.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx) | Screen content renderer | 123-177 (Suspense + LeaseBoundary wrapping) |
| [GraphRuntimeLeaseBoundary.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/runtime/GraphRuntimeLeaseBoundary.tsx) | Lease gate — renders pendingFallback or children | 38, 46-78, 128-135 |
| [GraphPhysicsPlaygroundShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx) | Graph runtime + restore path | 1135 (engine.clear), 1153-1170 (rAF signal) |
| [transitionContract.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/transitionContract.ts) | Transition policy (prompt→graph = no animation) | 27-28 |
| [useOnboardingTransition.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/useOnboardingTransition.ts) | Screen transition dispatcher | 88-93 (instant setScreen for non-animated) |
| [GraphScreenShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/GraphScreenShell.tsx) | Graph layout shell (no visibility gates) | 38-82 |
