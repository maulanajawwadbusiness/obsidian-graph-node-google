# Graph Screen Runtime Dead Scandissect (2026-02-16)

## Executive Summary
1. Preview and graph screen both mount the same runtime component chain (`GraphPhysicsPlayground` -> `GraphPhysicsPlaygroundContainer` -> `GraphPhysicsPlaygroundInternal`).
2. The biggest structural delta is graph-class-only wrappers: `GraphRuntimeLeaseBoundary` and conditional `GraphLoadingGate` overlay in graph path.
3. Render-loop start guards are simple (`canvasReady`, canvas exists, 2D context); nothing boxed-specific there.
4. The strongest failure seam that can make graph appear alive-but-dead is an invisible-but-interactive gate/shield layer in graph-class transition path.
5. Lease denial is less likely for graph screen (graph owner preempts by contract), but still a secondary seam to verify with runtime logs.

## Run 1 - Mount Path Delta (Preview vs Graph Screen)

### Preview Mount Chain
- `src/components/SampleGraphPreview.tsx:398` provides boxed viewport: `<GraphViewportProvider value={boxedViewport}>`.
- `src/components/SampleGraphPreview.tsx:174` and `src/components/SampleGraphPreview.tsx:182` set viewport mode to `'boxed'`.
- `src/components/SampleGraphPreview.tsx:260` acquires lease as `prompt-preview`.
- `src/components/SampleGraphPreview.tsx:343` gates mount on `canMountRuntime = leaseState.phase === 'allowed' && portalRootEl && sampleLoadResult.ok`.
- `src/components/SampleGraphPreview.tsx:401` mounts runtime only when `canMountRuntime` is true.
- `src/components/SampleGraphPreview.tsx:403` wraps runtime in `PortalScopeProvider mode="container"` + `TooltipProvider`.
- `src/components/SampleGraphPreview.tsx:404` mounts `<GraphPhysicsPlayground ... enableDebugSidebar={false} />`.

### Graph Screen Mount Chain
- `src/screens/appshell/render/renderScreenContent.tsx:117` wraps graph path with `<GraphScreenShell ...>`.
- `src/screens/appshell/render/GraphScreenShell.tsx:42` builds pane viewport via `useResizeObserverViewport(graphPaneRef, { mode: 'app', source: 'container' ... })`.
- `src/screens/appshell/render/GraphScreenShell.tsx:75` provides `<GraphViewportProvider value={graphPaneViewport}>`.
- `src/screens/appshell/render/renderScreenContent.tsx:119` wraps runtime with `<GraphRuntimeLeaseBoundary owner="graph-screen" ...>`.
- `src/screens/appshell/render/renderScreenContent.tsx:123` mounts `<GraphWithPending ...>` (runtime alias).
- `src/screens/appshell/render/renderScreenContent.tsx:147` conditionally mounts `<GraphLoadingGate ...>` only when `screen === 'graph_loading'`.

### Runtime Identity Proof
- `src/playground/GraphPhysicsPlayground.tsx:23` forwards to `GraphPhysicsPlaygroundContainer`.
- `src/playground/modules/GraphPhysicsPlaygroundContainer.tsx:1` re-exports from shell file.
- `src/playground/GraphPhysicsPlaygroundShell.tsx:1682` defines `GraphPhysicsPlaygroundContainer`.

## Preview vs Graph Delta Table
| Dimension | Preview | Graph Screen | Evidence |
|---|---|---|---|
| Runtime component identity | `GraphPhysicsPlayground` | `GraphWithPending` (lazy alias of same) | `src/components/SampleGraphPreview.tsx:404`, `src/screens/AppShell.tsx:72`, `src/screens/appshell/render/renderScreenContent.tsx:123`, `src/playground/GraphPhysicsPlayground.tsx:23` |
| Lease boundary shape | Local lease gate in preview component (`canMountRuntime`) | `GraphRuntimeLeaseBoundary` wrapper | `src/components/SampleGraphPreview.tsx:343`, `src/screens/appshell/render/renderScreenContent.tsx:119` |
| Lease owner | `prompt-preview` | `graph-screen` | `src/components/SampleGraphPreview.tsx:260`, `src/screens/appshell/render/renderScreenContent.tsx:120` |
| Viewport mode | `boxed` | `app` | `src/components/SampleGraphPreview.tsx:174`, `src/screens/appshell/render/GraphScreenShell.tsx:43` |
| Portal scope | Explicit `PortalScopeProvider mode="container"` | No local portal scope wrapper in render branch | `src/components/SampleGraphPreview.tsx:403`, `src/screens/appshell/render/renderScreenContent.tsx:117-164` |
| Input shields above runtime | Preview root capture wheel/pointer only while mounted | Graph path can add `GraphLoadingGate` overlay in `graph_loading` | `src/components/SampleGraphPreview.tsx:350-383`, `src/screens/appshell/render/renderScreenContent.tsx:147` |
| Overlay capture behavior | Preview wheel capture is scoped to preview root | `GraphLoadingGate` captures pointer + wheel and prevents wheel default | `src/components/SampleGraphPreview.tsx:358-380`, `src/screens/appshell/render/GraphLoadingGate.tsx:190-196` |
| Camera lock policy | Boxed enforces effective lock (`cameraLocked || isBoxedRuntime`) | App mode does not auto-lock by mode | `src/playground/GraphPhysicsPlaygroundShell.tsx:247-248` |

## Run 2 - Most Likely Failure Seam (Why Graph Can Feel Inert)

### Primary Hypothesis (Medium-High Confidence)
**Invisible interaction shield in graph-class path is active when graph is visible.**

Supporting evidence:
- `GraphLoadingGate` mounts in graph-class subtree when `screen === 'graph_loading'`: `src/screens/appshell/render/renderScreenContent.tsx:147`.
- Gate root always has `pointerEvents: 'auto'`: `src/screens/appshell/render/GraphLoadingGate.tsx:31`.
- Gate explicitly stops pointer capture events: `src/screens/appshell/render/GraphLoadingGate.tsx:190-192`.
- Gate wheel capture prevents default and stops propagation: `src/screens/appshell/render/GraphLoadingGate.tsx:193-196`.
- Gate can be visually transparent during entering/exiting (`opacity: 0`) while still mounted/intercepting: `src/screens/appshell/render/GraphLoadingGate.tsx:178-179`.

Why this matches symptom:
- User can still see graph (transparent overlay), but drag/wheel input is blackholed.
- Runtime under overlay can appear "dead" from user perspective even if loop is alive.

### Secondary Hypothesis 1 (Medium)
**Crossfade input shield from onboarding transition host remains active during graph-class transition.**
- `OnboardingLayerHost` adds full-screen `SCREEN_TRANSITION_INPUT_SHIELD_STYLE` with `pointerEvents: 'auto'` while `isCrossfading`: `src/screens/appshell/transitions/OnboardingLayerHost.tsx:57-66`, style at `src/screens/appshell/transitions/OnboardingLayerHost.tsx:105-109`.
- This would block pointer/wheel similarly while graph remains visible.

### Secondary Hypothesis 2 (Low-Medium)
**Render loop is not starting on graph screen due mount guard failure.**
- Render loop starts only if `canvasReady && canvas && engine && ctx`: `src/playground/useGraphRendering.ts:149-157`.
- Loop is created at `startGraphRenderLoop(...)`: `src/playground/useGraphRendering.ts:161`.
- If no loop, there should be dev log `[RenderLoop] skipped ...` from same file; absence/presence becomes decisive.

### Secondary Hypothesis 3 (Low)
**Lease ownership conflict suppresses real graph runtime.**
- Graph owner preempts any existing non-graph owner by design: `src/runtime/graphRuntimeLease.ts:137-151`.
- So pure lease-deny for graph-screen is unlikely unless lifecycle ordering is broken elsewhere.

## Run 3 - Minimal Observability Hooks (Only if Needed)

No behavior fix proposed here. Existing logs already cover some signals:
- lease acquire/deny/preempt/release logs already exist in `src/runtime/graphRuntimeLease.ts:109-116` and callers.
- render-loop start/skip logs already exist in `src/playground/useGraphRendering.ts:149-161`.

If additional confirmation is needed, add only these two DEV-only counters:

1. **Graph gate shield counter**
- File: `src/screens/appshell/render/GraphLoadingGate.tsx`
- Insert at gate event captures (`onPointerDownCapture`, `onWheelCapture`) around `src/screens/appshell/render/GraphLoadingGate.tsx:190-196`.
- Counter names:
  - `graphLoadingGatePointerBlockedCount`
  - `graphLoadingGateWheelBlockedCount`
- Manual read: log once every N events, or expose on `window.__graphGateDebug` in dev.

2. **Graph render loop tick presence counter**
- File: `src/playground/rendering/graphRenderingLoop.ts`
- Insert inside `render()` near first-frame block around `src/playground/rendering/graphRenderingLoop.ts:323-329`.
- Counter name:
  - `graphRuntimeRafTickCount`
- Manual read: periodic dev log every 120 ticks (`~2s`) confirms runtime alive.

Optional third hook (only if still ambiguous):
- File: `src/runtime/GraphRuntimeLeaseBoundary.tsx`
- At acquire/reacquire paths (`src/runtime/GraphRuntimeLeaseBoundary.tsx:39`, `src/runtime/GraphRuntimeLeaseBoundary.tsx:72`), add a concise dev log with owner and resulting phase.

## Most Likely Root Cause
**Most likely root cause: an active graph-class transition/loading input shield (`GraphLoadingGate` and/or transition shield) intercepting input while graph remains visible.**
Confidence: **Medium-High**.

## Next Question for Opus
When symptom reproduces, what are the live values of:
- `screen`, `gatePhase`, `gateVisualPhase`, and `data-gate-interaction-locked` on root (`AppShell`/`GraphLoadingGate`), and
- whether `[RenderLoop] start` is logged for graph screen mount?

That single snapshot will distinguish "overlay blackhole" vs "render loop not running" immediately.
