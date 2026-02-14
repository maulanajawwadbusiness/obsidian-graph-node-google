# Run 6b Report: Health Routes Wiring

Date: 2026-02-14
Scope: wire monolith to healthRoutes module

## Changes
- Updated `src/server/src/serverMonolith.ts`:
  - Removed inline `GET /health` handler.
  - Added `registerHealthRoutes(app, { getPool })`.
  - Added import for `registerHealthRoutes`.

## Ordering Parity
- Registration remains in the same relative place as baseline:
  - after `app.use(cors(corsOptions))`
  - after `app.options(/.*/, cors(corsOptions))`
  - before auth route registrations

## Parity Checklist
- Method and path unchanged: `GET /health`
- Auth unchanged: unauthenticated
- Response contract unchanged:
  - success: `200` with `{ ok: true }`
  - DB error: `500` with `{ ok: false, error: String(e) }`
- No webhook/CORS/parser/startup order changes.
