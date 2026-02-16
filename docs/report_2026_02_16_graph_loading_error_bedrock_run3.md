# Graph Loading Error Bedrock Run 3 (2026-02-16)

## Scope
- Integrate AppShell gate with runtime status object (`isLoading` + `aiErrorMessage`).
- Implement gate error phase and force-back policy.
- Keep sidebar disable rule loading-only.

## Files
- `src/screens/AppShell.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/appshell/render/graphLoadingGateMachine.ts`

## What Changed
1. AppShell now stores runtime status snapshot instead of loading-only boolean state.
2. Render seam now wires both callbacks from graph runtime:
   - `onLoadingStateChange` (compat)
   - `onRuntimeStatusChange` (authoritative pair payload)
3. Gate machine now recognizes `error` phase when:
   - screen is `graph_loading`
   - loading is false
   - runtime error message is present
   - entry intent is not `none`
4. Force-back policy added:
   - `getGateNextAction(...)` returns `force_back_prompt` for gate `error`
   - AppShell consumes this action once and transitions to `prompt`
5. Sidebar disable remains tied to true loading only (`runtime.isLoading`), not error presence.

## Contract Outcome
- Gate no longer depends on error-as-loading coupling.
- Error phase can no longer be overridden by watchdog.
- Confirm controls remain unavailable for error phase.
