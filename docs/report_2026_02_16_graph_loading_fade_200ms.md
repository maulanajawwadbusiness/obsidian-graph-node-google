# Graph Loading Fade 200ms Hardening (2026-02-16)

## Scope
- Add deterministic enter/exit fade for `GraphLoadingGate`.
- Keep existing graph boundary transition policy unchanged.
- Prevent input race leaks during fade-out.

## Files Changed
- `src/screens/appshell/transitions/transitionTokens.ts`
- `src/screens/appshell/render/GraphLoadingGate.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/AppShell.tsx`
- `docs/system.md`
- `docs/repo_xray.md`

## Contract
1. Loading screen fade is fixed at `200ms` on both enter and exit.
2. Exit is deferred:
   - `graph_loading -> graph` and `graph_loading -> prompt` commit only after fade-out timer completes.
3. During exit fade:
   - gate remains mounted
   - gate keeps pointer/wheel/keyboard ownership
   - repeat actions are blocked (idempotent exit lock).

## Implementation Notes
- Added canonical fade tokens:
  - `GRAPH_LOADING_SCREEN_FADE_MS = 200`
  - `GRAPH_LOADING_SCREEN_FADE_EASING = cubic-bezier(0.22, 1, 0.36, 1)`
- Added gate visual phase model:
  - `entering`, `visible`, `exiting`
- AppShell now drives deferred exit with timer-based transition commit.
- Added immediate ref lock (`gateExitRequestedRef`) to prevent same-tick multi-trigger races.
- Added observability:
  - AppShell data markers and DEV logs (`[GateFade] ...`)
  - gate root data markers for visual phase and interaction lock.

## Verification
1. Enter path:
   - `prompt -> graph_loading` shows 200ms fade-in.
2. Exit confirm path:
   - `graph_loading(done) -> graph` waits 200ms fade-out before transition.
3. Exit back path:
   - `graph_loading(error|stalled) -> prompt` waits 200ms fade-out before transition.
4. Rapid key/click spam during exit:
   - no duplicate transition commits.
