# Run3a Report: jsonParsers Module Added (No Wiring)

Date: 2026-02-14
Scope: add json parser seam module only
Status: completed

## Summary

Added module:
- `src/server/src/server/jsonParsers.ts`

No wiring changes were made to `serverMonolith.ts` in this run.

## Exported API

- `type JsonParserConfig`
  - `savedInterfacesJsonLimit: string`
  - `globalJsonLimit: string`
- `applyJsonParsers(app, cfg)`

## Preserved Invariants in Module Implementation

Inside `applyJsonParsers`:
1. builds saved-interfaces parser with `express.json({ limit: cfg.savedInterfacesJsonLimit })`
2. mounts parser on `/api/saved-interfaces`
3. builds global parser with `express.json({ limit: cfg.globalJsonLimit })`
4. skip gate excludes `/api/saved-interfaces` from global parser
5. error middleware maps only saved-interfaces `entity.too.large` to:
   - status `413`
   - body `{ ok: false, error: "saved interface payload too large" }`

Path check parity with current monolith:
- uses `req.path.startsWith("/api/saved-interfaces")`

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
