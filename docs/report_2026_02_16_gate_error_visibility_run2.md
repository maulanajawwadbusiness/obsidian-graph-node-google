# Gate Error Visibility Run 2 (2026-02-16)

## Scope
- Add phase-aware gate UI so error and stalled states are explicitly visible.
- Preserve existing input shielding and keyboard capture ownership.

## Files
- `src/screens/appshell/render/GraphLoadingGate.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/AppShell.tsx`

## Changes
1. `GraphLoadingGate` now receives:
   - `phase`
   - `errorMessage`
2. Gate content is phase-driven:
   - `loading`: `Loading...`
   - `done/confirmed`: `Loading Complete`
   - `stalled`: `Loading stalled. Please go back to prompt.`
   - `error`: `Loading Failed` + runtime error message
3. Confirm control is non-actionable during `error`.
4. Back remains available via existing controls and Escape.

## Result
- Product path no longer hides gate-phase error context behind generic loading text.
- Users can see error reason directly on gate before choosing next action.
