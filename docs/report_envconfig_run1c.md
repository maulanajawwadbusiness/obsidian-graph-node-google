# Run1c Report: envConfig Parity Scan Guard

Date: 2026-02-14
Scope: static scan after envConfig wiring
Status: completed

## Remaining process.env in serverMonolith.ts

Current remaining usages:
- `process.env.MIDTRANS_SERVER_KEY`
- `process.env.GOOGLE_CLIENT_ID`
- `process.env.GOOGLE_CLIENT_ID` (audience log line)

Interpretation:
- expected for this phase
- these are non-target env reads (payments/auth provider keys)
- targeted top-of-file env/constants seam moved to `server/envConfig.ts`

## Default Value Parity Check (Moved Set)

Confirmed in `src/server/src/server/envConfig.ts`:
- `PORT` default: `8080`
- session cookie name default: `arnvoid_session`
- session ttl default: `1000 * 60 * 60 * 24 * 7`
- cookie sameSite constant: `lax`
- saved-interface parser limit default: `15mb`
- saved-interface payload byte default: `15 * 1024 * 1024`

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
