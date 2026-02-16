# Graph Loading Error Bedrock Run 5 (2026-02-16)

## Scope
- Final hardening pass for gate error/loading contract.
- Docs sync to lock the new contract as canonical system truth.

## Files
- `src/screens/appshell/render/graphLoadingGateMachine.ts`
- `src/screens/AppShell.tsx`
- `docs/system.md`
- `docs/repo_xray.md`

## Hardening Changes
1. No-intent precedence:
   - `entryIntent === 'none'` now resolves to `done` before error checks.
   - protects no-work path from stale error carryover.
2. Stale error clear on gate entry:
   - entering `graph_loading` now clears runtime error snapshot in AppShell state.
   - prevents immediate false `error` phase from old prompt-cycle failures.
3. Gate contract DEV logs:
   - `[GateContract] phase=<...> loading=<...> error=<...> intent=<...> seen=<...>`
   - emitted only in DEV during `graph_loading`.
4. Gate controls now derived once per render (`gateControls`) to keep intent clear and avoid drift.

## Docs Sync
1. `docs/system.md` updated:
   - split loading/error runtime contract
   - gate `error` phase + force-back policy
   - loading-only sidebar disable policy
   - prompt inline error handoff behavior
2. `docs/repo_xray.md` updated:
   - step summary now includes split runtime status and force-back + prompt-banner error flow

## Verification
- `npm run build` passes after final hardening changes.
