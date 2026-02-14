# Run3c Report: jsonParsers Contract Guard

Date: 2026-02-14
Scope: deterministic parser-contract guard script
Status: completed, tests passing

## Summary

Added guard script:
- `src/server/scripts/test-jsonparsers-contracts.mjs`

Added npm script:
- `test:jsonparsers-contracts`

## What the Guard Verifies

The script builds a small express app and applies:
- `applyJsonParsers(app, { savedInterfacesJsonLimit: "1kb", globalJsonLimit: "1kb" })`

Test endpoints:
- `POST /api/saved-interfaces/upsert`
- `POST /api/other`

Oversized JSON body (`>1kb`) assertions:
1. Saved-interfaces route:
   - status is `413`
   - JSON body is exactly `{ ok:false, error:"saved interface payload too large" }`
2. Non-saved route:
   - status is non-2xx
   - saved-interfaces custom error message does not leak

This locks the saved-only 413 mapping invariant and prevents accidental global leakage.

## Verification

Commands run in `src/server`:
```powershell
npm run build
npm run test:jsonparsers-contracts
```

Observed output:
- `[jsonparsers-contracts] saved-interfaces 413 mapping ok`
- `[jsonparsers-contracts] non-saved route does not leak custom mapping`
- `[jsonparsers-contracts] done`
