# Run1a Report: envConfig Module Added (No Wiring)

Date: 2026-02-14
Scope: add env/constants seam module only
Status: completed

## Summary

Added new module:
- `src/server/src/server/envConfig.ts`

No changes were made to:
- `src/server/src/serverMonolith.ts`
- route registration order
- middleware order
- startup gate sequence

## Added API

Exports in `envConfig.ts`:
- `type ServerEnvConfig`
- `loadServerEnvConfig(): ServerEnvConfig`

`ServerEnvConfig` fields added:
- `port`
- `cookieName`
- `sessionTtlMs`
- `cookieSameSite`
- `devPorts`
- `defaultDevOrigins`
- `defaultAllowedOrigins`
- `allowedOriginsRaw`
- `corsAllowedOrigins`
- `savedInterfacesListLimit`
- `maxSavedInterfacePayloadBytes`
- `savedInterfaceJsonLimit`
- `isProd`
- `devBypassBalanceEnabled`
- `shouldWarnMissingAllowedOriginsInProd`
- `isOpenrouterAnalyzeAllowed(model)`

## Behavior Parity Intent

Module values and parsing are aligned to current monolith behavior:
- defaults: `8080`, `arnvoid_session`, `7 days`, `lax`, `15mb`, `15 * 1024 * 1024`
- prod detection rule unchanged
- dev balance bypass rule unchanged
- openrouter allowlist behavior unchanged
- CORS allowed origins fallback behavior unchanged

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
