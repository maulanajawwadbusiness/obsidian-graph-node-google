# Commit 4f75e1b Regression Forensics (2026-02-16)

## Executive Summary
- Scope was strictly `2fbf215` (known-good) vs `4f75e1b` (first bad).
- There is exactly one commit in that range: `4f75e1b`.
- `2fbf215` only changed resize observer code (`src/runtime/viewport/useResizeObserverViewport.ts`), not AppShell or graph gate logic.
- `4f75e1b` changed AppShell gate wiring in three code files: `src/screens/AppShell.tsx`, `src/screens/appshell/render/graphLoadingGateMachine.ts`, and `src/screens/appshell/render/renderScreenContent.tsx`.
- Primary regression is not a permanent gate overlay on `graph` screen.
- Primary regression is a render feedback loop introduced by the new runtime-status bridge (callback identity + object state writes).
- This loop can starve runtime tick/input and makes graph feel inert (no drag, no motion), while unrelated preview path can still appear functional.
- Force-back error policy exists, but it is secondary; it applies only to `graph_loading` + `error` and is not the main kill switch for inert graph runtime.

## What Changed In 4f75e1b
- Files changed:
  - `src/screens/AppShell.tsx`
  - `src/screens/appshell/render/graphLoadingGateMachine.ts`
  - `src/screens/appshell/render/renderScreenContent.tsx`
  - `docs/report_2026_02_16_graph_loading_error_bedrock_run3.md`
- State model change in AppShell:
  - Replaced boolean `graphIsLoading` state with object snapshot `{ isLoading, aiErrorMessage }` at `src/screens/AppShell.tsx:122`.
  - Gate base now consumes full runtime snapshot at `src/screens/AppShell.tsx:433` and `src/screens/AppShell.tsx:436`.
- New gate/error branches:
  - Error phase branch added in gate machine at `src/screens/appshell/render/graphLoadingGateMachine.ts:58`.
  - New force-back action `force_back_prompt` at `src/screens/appshell/render/graphLoadingGateMachine.ts:98` and `src/screens/appshell/render/graphLoadingGateMachine.ts:100`.
  - AppShell now consumes that action and transitions to prompt at `src/screens/AppShell.tsx:473` and `src/screens/AppShell.tsx:480`.
- New runtime callback wiring:
  - `renderScreenContent` now passes both callbacks:
    - `onLoadingStateChange` writes object state via spread at `src/screens/appshell/render/renderScreenContent.tsx:112` and `src/screens/appshell/render/renderScreenContent.tsx:113`.
    - `onRuntimeStatusChange` writes full status object at `src/screens/appshell/render/renderScreenContent.tsx:115` and `src/screens/appshell/render/renderScreenContent.tsx:116`.

## Why It Freezes Graph (Primary Root Cause)
Primary root cause: unbounded render feedback loop in the runtime-status bridge introduced by `4f75e1b`.

Proof chain:
- Child emits runtime status in an effect that depends on callback identity at `src/playground/GraphPhysicsPlaygroundShell.tsx:1323` and `src/playground/GraphPhysicsPlaygroundShell.tsx:1335`.
- AppShell passes `onRuntimeStatusChange` as an inline function (new identity every parent render) at `src/screens/appshell/render/renderScreenContent.tsx:115`.
- That callback always writes a new object into state (`setGraphRuntimeStatus(status)`) at `src/screens/appshell/render/renderScreenContent.tsx:116`.
- Child also emits loading state in an effect that depends on callback identity at `src/playground/GraphPhysicsPlaygroundShell.tsx:1319` and `src/playground/GraphPhysicsPlaygroundShell.tsx:1321`.
- AppShell loading callback also always allocates a new object (`{ ...prev, isLoading: v }`) at `src/screens/appshell/render/renderScreenContent.tsx:113`.
- Result: parent rerender creates new callback identities, child effects rerun, callbacks write new objects again, rerender repeats.

Why this triggers in normal flow:
- It does not require real error state.
- Even with `aiErrorMessage = null` and stable loading boolean, object writes and callback identity changes are sufficient to keep the loop alive.

Direct answers to kill-switch checks:
- Stuck in `graph_loading`: not required for this failure mode.
- `interactionLocked` always true: not applicable in `4f75e1b` (that prop/state is introduced later, not here).
- Overlay mounted with `pointerEvents:auto`: gate overlay exists and blocks input (`src/screens/appshell/render/GraphLoadingGate.tsx:23`, `src/screens/appshell/render/GraphLoadingGate.tsx:132`), but it is mounted only when `screen === 'graph_loading'` (`src/screens/appshell/render/renderScreenContent.tsx:130`). This does not explain inert `graph` screen by itself.
- Force-back prevents lease/tick: force-back exists (`src/screens/AppShell.tsx:473`, `src/screens/AppShell.tsx:480`) but is gated to `graph_loading` error phase; it is not the primary mechanism for graph runtime inertness.

## Fix Plan
- Stabilize runtime callback identities and state writes:
  - Keep callback references stable (no per-render function identity churn).
  - Ignore no-op runtime-status updates (do not set state when values are unchanged).
- Preserve gate error policy separately:
  - Keep `error` phase and force-back behavior for true failures.
  - Ensure force-back path cannot create render churn in normal non-error graph runtime.
- Add invariant guard:
  - Dev-only counter/warn if runtime status callback causes repeated same-value state commits over consecutive frames.

## Verification Checklist
- Confirm no render storm:
  - Enter `graph_loading` then `graph`; verify no rapid repeated AppShell rerenders from identical runtime status payloads.
- Confirm graph interactivity:
  - Drag dots and observe autonomous motion in `graph` screen.
- Confirm gate policy still works:
  - Inject real analysis error; verify `error` phase behavior and controlled return to `prompt` still function.
- Confirm no leaked input shield:
  - In `graph` screen, verify no gate overlay is mounted and pointer/wheel reach canvas.
