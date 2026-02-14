# Run 8c Report: Profile Route Contract Guard

Date: 2026-02-14
Scope: deterministic contract guard for extracted profile update route

## Added
- `src/server/scripts/test-profile-contracts.mjs`
- npm script: `test:profile-contracts`

## What This Guard Locks
- Gating contract:
  - when `getProfileColumnsAvailable=false`, `POST /api/profile/update` returns `503` with `ok:false`
  - DB query path is not executed
- Validation contract:
  - invalid username returns `400` with `ok:false`
  - DB query path is not executed
- Success contract:
  - valid payload returns `200` with `ok:true`
  - response has `user` with stable fields including `sub`, `displayName`, `username`
  - displayName normalization path remains effective
- User-not-found contract:
  - update with no returned row gives `404` with `ok:false`

## What This Guard Does Not Lock
- exact full error string text for every branch
- real DB behavior and SQL planner behavior
- unique/index conflict semantics not present in current handler

## Test Strategy
- tiny express app with `express.json({ limit: "1mb" })`
- stub `requireAuth` sets `res.locals.user = { id: "u1" }`
- `getProfileColumnsAvailable` toggled per case
- fake pool recognizes only profile update SQL shape
