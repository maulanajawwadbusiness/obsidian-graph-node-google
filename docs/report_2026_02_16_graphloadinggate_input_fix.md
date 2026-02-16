# GraphLoadingGate Input Regression Fix
Date: 2026-02-16
Scope: Graph screen runtime inert during graph_loading fade exit

## Executive Summary
- Root cause was confirmed in `GraphLoadingGate`: capture handlers and wheel prevent-default remained active while `visualPhase==='exiting'`.
- During exit fade, the gate became visually transparent but still acted as an input shield, blocking graph drag, wheel, and effective interaction.
- Input blocking is now phase-aware: gate only blocks while truly locked and not exiting.
- During `exiting`, gate pointer ownership is released immediately via `pointerEvents: 'none'` and guarded handlers.
- Added a fail-safe timer in `AppShell` so `graph_loading` cannot remain stuck in `exiting` indefinitely.

## Problem Statement
Symptom:
- EnterPrompt boxed preview runtime remained fully alive.
- Graph screen runtime appeared rendered but behaved dead (no drag, no wheel interaction, no practical physics interaction).

Confirmed seam:
- `src/screens/appshell/render/GraphLoadingGate.tsx` used unconditional pointer capture and wheel `preventDefault` even while fading out.
- `AppShell` keeps `screen==='graph_loading'` mounted during fade duration, so the shield persisted through the whole window.

## Changes Implemented

### 1) Release input during fade-out in GraphLoadingGate
File: `src/screens/appshell/render/GraphLoadingGate.tsx`

Key anchors:
- `src/screens/appshell/render/GraphLoadingGate.tsx:142`
- `src/screens/appshell/render/GraphLoadingGate.tsx:143`
- `src/screens/appshell/render/GraphLoadingGate.tsx:192`
- `src/screens/appshell/render/GraphLoadingGate.tsx:211`
- `src/screens/appshell/render/GraphLoadingGate.tsx:215`
- `src/screens/appshell/render/GraphLoadingGate.tsx:227`

Behavior changes:
- `isInteractionBlocked` now reflects lock state only (`interactionLocked`).
- Added `shouldBlockInput = interactionLocked && !isFadingOut`.
- Root style now forces `pointerEvents: 'none'` while `visualPhase==='exiting'`.
- Pointer/wheel capture handlers now early-return unless `shouldBlockInput`.
- Wheel `preventDefault()` now only runs when blocking is active.

Result:
- No invisible input shield during gate exit fade.
- Graph becomes interactive as soon as gate starts exiting.

### 2) Dev-only regression rails in GraphLoadingGate
File: `src/screens/appshell/render/GraphLoadingGate.tsx`

Key anchors:
- `src/screens/appshell/render/GraphLoadingGate.tsx:153`
- `src/screens/appshell/render/GraphLoadingGate.tsx:203`

Added:
- Dev counters on `window.__arnvoidDebugCounters`:
  - `graphLoadingGateMountCount`
  - `graphLoadingGateUnmountCount`
- Warn-once invariant:
  - `[GateInputInvariant] fading_out_pointer_events_must_be_none`

### 3) Exit-phase fail-safe in AppShell
File: `src/screens/AppShell.tsx`

Key anchors:
- `src/screens/AppShell.tsx:152`
- `src/screens/AppShell.tsx:305`
- `src/screens/AppShell.tsx:351`
- `src/screens/AppShell.tsx:358`

Added:
- `gateExitFailsafeTimerRef`.
- `clearGateVisualTimers` now clears enter RAF, normal exit timer, and fail-safe timer.
- New effect: while `screen==='graph_loading'`, `gateVisualPhase==='exiting'`, and exit target exists, arm a fail-safe at `2 * GRAPH_LOADING_SCREEN_FADE_MS`.
- If still exiting at fail-safe deadline, force `transitionToScreen(pendingGateExitTarget)` and emit dev warning:
  - `[GateFadeFailsafe] forced_exit target=%s after=%dms`

Result:
- Prevents indefinite lingering in `graph_loading` exit state.

## Verification
### Build
- Command: `npm run build`
- Result: PASS (TypeScript + Vite build completed).

### Manual verification checklist
1. Prompt -> Enter graph -> graph_loading appears.
2. Trigger confirm.
3. As soon as gate starts fade-out (`visualPhase='exiting'`), attempt drag and wheel on graph.
4. Expected: interaction works immediately; no dead window until screen switch commit.
5. Verify preview boxed runtime still behaves as before.
6. Optional DEV checks:
   - Inspect `window.__arnvoidDebugCounters` mount/unmount counters.
   - Confirm no `[GateInputInvariant]` warnings under normal operation.
   - Confirm `[GateFadeFailsafe]` warning does not fire in healthy flow.

## Risk and Compatibility Notes
- Scope is tight to gate input ownership and exit-timer robustness.
- No change to graph physics, render loop, or camera math.
- No change to step10 boxed wheel ownership policy.
- No change to step11 boxed portal policy.
- App mode intent preserved; only removes unintended input blocking during transparent gate phase.

## Remaining Monitoring
- If fail-safe warning appears in DEV, investigate timer orchestration around gate exit lifecycle.
- If any key handling side effects appear during graph_loading, re-check global keydown capture in `AppShell` graph_loading effect.
