# Run1b Report: Wire serverMonolith to envConfig

Date: 2026-02-14
Scope: monolith wiring to envConfig with no behavior change
Status: completed

## Summary

Updated `src/server/src/serverMonolith.ts` to consume `loadServerEnvConfig()` values for the targeted env/constants seam.

No route bodies were moved in this run.

## Constants and Rules Moved to envConfig Wiring

Replaced inline monolith reads with config values:
- `PORT` -> `serverEnv.port`
- `SESSION_COOKIE_NAME` -> `serverEnv.cookieName`
- `SESSION_TTL_MS` -> `serverEnv.sessionTtlMs`
- cookie sameSite constant -> `serverEnv.cookieSameSite` (`lax`)
- `SAVED_INTERFACES_LIST_LIMIT` -> `serverEnv.savedInterfacesListLimit`
- `MAX_SAVED_INTERFACE_PAYLOAD_BYTES` -> `serverEnv.maxSavedInterfacePayloadBytes`
- `SAVED_INTERFACE_JSON_LIMIT` -> `serverEnv.savedInterfaceJsonLimit`
- CORS allowed origins set -> `serverEnv.corsAllowedOrigins`
- prod missing ALLOWED_ORIGINS warning gate -> `serverEnv.shouldWarnMissingAllowedOriginsInProd`
- prod detection helper -> `serverEnv.isProd`
- dev balance bypass helper -> `serverEnv.devBypassBalanceEnabled`
- openrouter analyze allow helper -> `serverEnv.isOpenrouterAnalyzeAllowed(model)`

## Parity Checklist

- Route paths changed: no
- Route registration order changed: no
- Middleware order changed: no
  - saved-interfaces parser chain unchanged
  - webhook-before-cors unchanged
  - CORS middleware + preflight wiring unchanged
- Startup gate order changed: no
  - assertAuthSchemaReady -> detectProfileColumnsAvailability -> listen unchanged
- Warning string changed: no
  - `[cors] ALLOWED_ORIGINS not set in prod; CORS will block real frontend`

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
