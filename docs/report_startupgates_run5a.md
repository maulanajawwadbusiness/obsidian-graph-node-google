# Run5a Report: startupGates Module Added (No Wiring)

Date: 2026-02-14
Scope: add startup gates seam module only
Status: completed

## Summary

Added module:
- `src/server/src/server/startupGates.ts`

No changes were made to `serverMonolith.ts` in this run.

## Exported API

- `type AuthSchemaReadyResult`
- `type StartupGatesDeps`
- `detectProfileColumnsAvailability(getPoolFn)`
- `runStartupGates(deps)`

## Preserved Invariants in Module

- `detectProfileColumnsAvailability` uses the same information_schema query and same `display_name` + `username` presence check as monolith.
- `runStartupGates` executes in required order:
  1. `assertAuthSchemaReady()`
  2. `detectProfileColumnsAvailability(getPool)`
- `runStartupGates` logs the same two startup lines in the same order:
  - `[auth-schema] ready db=... tables=... fk_sessions_user=... uq_users_google_sub=... uq_sessions_id=...`
  - `[auth-schema] profile_columns_available=...`
- module does not call `process.exit`; errors propagate to caller.

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
