# Run5c Report: startupGates Contract Guard

Date: 2026-02-14
Scope: deterministic startup gates contract script
Status: completed, tests passing

## Summary

Added guard script:
- `src/server/scripts/test-startupgates-contracts.mjs`

Added npm script:
- `test:startupgates-contracts`

## What the Guard Locks

Using stub deps (no real DB), it verifies:

1. Startup call order:
- `assertAuthSchemaReady` happens before profile-column detection query
- asserted call sequence:
  - `["assertAuthSchemaReady", "detectProfileColumnsAvailability"]`

2. Return shape and values:
- `runStartupGates` returns `{ schema, profileColumnsAvailable }`
- in stub case with both columns present, `profileColumnsAvailable === true`

3. Startup log order:
- first log starts with `[auth-schema] ready`
- second log starts with `[auth-schema] profile_columns_available=`

## Verification

Commands run in `src/server`:
```powershell
npm run build
npm run test:startupgates-contracts
```

Observed output:
- `[startupgates-contracts] startup order and return shape ok`
- `[startupgates-contracts] startup logs order ok`
- `[startupgates-contracts] done`
