# Run 13c Report: Bootstrap Extraction and Monolith Shell

Date: 2026-02-14
Scope: move orchestration body to bootstrap and keep monolith as thin entry shell

## Added
- `src/server/src/server/bootstrap.ts`

## Updated
- `src/server/src/serverMonolith.ts`

## What Changed

1. Boot orchestration moved to `bootstrap.ts`:
- app creation and trust proxy
- env load and CORS setup
- JSON parser seam application
- route deps assembly via `buildRouteDeps(...)`
- route registration sequence
- startup gates before listen
- listen and fatal startup error logging

2. `serverMonolith.ts` is now a thin shell:
- imports `startServer` from bootstrap
- executes `void startServer()`

3. Side-effect startup behavior remains intact:
- `src/server/src/index.ts` still imports `./serverMonolith`
- importing monolith still starts server.

## Order and Contract Parity Checklist

1. JSON parser chain remains before routes.
2. webhook route registration remains before CORS.
3. CORS wiring unchanged:
- `app.use(cors(corsOptions))`
- `app.options(/.*/, cors(corsOptions))`
4. route registration order unchanged:
- health
- auth
- profile
- saved-interfaces
- rupiah/payments create
- llm analyze
- payments status
- llm prefill
- llm chat
5. startup gates still run before listen.
6. startup logs preserved.

## Result
Server monolith is now strictly a startup shell, and orchestration ownership is explicit in `bootstrap.ts` with order invariants preserved.
