# Run 6c Report: Health Contract Guard

Date: 2026-02-14
Scope: deterministic contract guard for extracted health route

## Added
- `src/server/scripts/test-health-contracts.mjs`
- npm script: `test:health-contracts`

## Guard Coverage
- Spins up a tiny express app and registers `registerHealthRoutes` with stubbed `getPool`.
- Calls `GET /health` and asserts:
  - status is `200`
  - JSON includes `ok: true`
  - DB probe query is exactly `SELECT 1` and called once

## Locked Invariant
- `GET /health` remains unauth DB ping endpoint with stable success contract.
