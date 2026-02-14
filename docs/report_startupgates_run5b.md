# Run5b Report: Wire serverMonolith to startupGates seam

Date: 2026-02-14
Scope: replace local startup gate implementation with runStartupGates
Status: completed

## Summary

Updated `src/server/src/serverMonolith.ts`:
- removed local `detectProfileColumnsAvailability` function
- updated `startServer()` to call `runStartupGates({ assertAuthSchemaReady, getPool, logger: console })`
- assigned `profileColumnsAvailable = startup.profileColumnsAvailable`

## Parity Checklist

Startup call order:
- preserved
  1. `assertAuthSchemaReady()` (inside runStartupGates)
  2. `detectProfileColumnsAvailability()` (inside runStartupGates)
  3. `app.listen(...)`

Fatal behavior:
- preserved
- `catch` block still logs:
  - `[auth-schema] fatal startup failure: ${String(error)}`
- still calls `process.exit(1)`

profileColumnsAvailable semantics:
- preserved
- boolean is still assigned before `app.listen(...)`
- same shared variable used by `/auth/google`, `/me`, and `/api/profile/update`

Listen behavior:
- preserved
- listen location unchanged (after startup gates)
- server listen log string unchanged

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
