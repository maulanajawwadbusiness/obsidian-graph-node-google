# Gate Error Visibility Run 1 (2026-02-16)

## Scope
- Remove automatic error-gate redirect behavior.
- Prepare explicit-back contract as the only valid exit path for gate error.

## Files
- `src/screens/appshell/render/graphLoadingGateMachine.ts`
- `src/screens/AppShell.tsx`

## Changes
1. `getGateNextAction(...)` no longer returns an auto redirect action for `error`.
2. AppShell no longer auto-transitions to prompt when gate enters `error`.
3. Added DEV contract guard:
   - warns if app exits an error-visible gate without explicit back action.
4. Back action now owns prompt error handoff when gate phase is `error`.

## Result
- Error phase persists on gate until user chooses Back.
- Gate is now able to become the primary error surface in next run.
