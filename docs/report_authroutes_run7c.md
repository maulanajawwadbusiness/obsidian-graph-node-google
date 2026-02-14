# Run 7c Report: Auth /me + Logout Contract Guard

Date: 2026-02-14
Scope: deterministic contract guard for extracted auth route behavior

## Added
- `src/server/scripts/test-auth-me-contracts.mjs`
- npm script: `test:auth-me-contracts`

## Guard Cases
1. `GET /me` with no cookie:
   - expects status `200`
   - expects `{ ok: true, user: null }`
   - expects no `set-cookie` header

2. `GET /me` with cookie but missing session:
   - expects status `200`
   - expects `{ ok: true, user: null }`
   - expects cookie clear (`set-cookie` header present)

3. `POST /auth/logout` with cookie but missing session:
   - expects status `200`
   - expects `{ ok: true }`
   - expects cookie clear (`set-cookie` header present)

## Locked Invariant
- `/me` and `/auth/logout` cookie/session null-state behavior remains parity-safe after route extraction.
