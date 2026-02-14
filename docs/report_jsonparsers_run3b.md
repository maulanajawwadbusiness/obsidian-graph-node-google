# Run3b Report: Wire serverMonolith to jsonParsers seam

Date: 2026-02-14
Scope: replace inline parser wiring with applyJsonParsers
Status: completed

## Summary

Updated `src/server/src/serverMonolith.ts`:
- removed inline parser middleware block
- replaced with:
  - `applyJsonParsers(app, { savedInterfacesJsonLimit: SAVED_INTERFACE_JSON_LIMIT, globalJsonLimit: LLM_LIMITS.jsonBodyLimit })`

Placement was kept at the same top-level location before route registration.

## Parity Checklist

Custom 413 mapping (exact):
- status: `413`
- body: `{ ok: false, error: "saved interface payload too large" }`
- trigger: `err?.type === "entity.too.large"` and saved-interfaces path prefix

Skip gate parity:
- global parser still skips `/api/saved-interfaces` prefix to avoid double parse

Limit parity:
- saved-interfaces parser limit source unchanged:
  - `SAVED_INTERFACE_JSON_LIMIT` (from envConfig default `15mb`)
- global parser limit source unchanged:
  - `LLM_LIMITS.jsonBodyLimit`

Order parity:
- parser chain still mounted before webhook route and before CORS middleware
- no route path changes

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
