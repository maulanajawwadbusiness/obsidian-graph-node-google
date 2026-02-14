# Run 9c Report: Saved Interfaces Contract Guard

Date: 2026-02-14
Scope: deterministic contract guard for extracted saved-interfaces routes

## Added
- `src/server/scripts/test-saved-interfaces-contracts.mjs`
- npm script: `test:saved-interfaces-contracts`

## What This Guard Locks
- List contract:
  - `GET /api/saved-interfaces` returns `200`, `ok:true`, and `items[]` with expected key surface.
- Upsert validation contracts:
  - missing `clientInterfaceId` -> `400`, `ok:false`
  - missing `title` -> `400`, `ok:false`
  - invalid `payloadVersion` -> `400`, `ok:false`
  - non-object `payloadJson` -> `400`, `ok:false`
- Upsert size guard:
  - oversized payload -> `413` and exact error string `saved interface payload too large`
- Upsert success:
  - valid payload -> `200`, `{ ok:true }`
- Delete contracts:
  - missing `clientInterfaceId` -> `400`, `ok:false`
  - delete rowCount 0 -> `deleted:false`
  - delete rowCount >0 -> `deleted:true`

## What This Guard Does Not Lock
- exact SQL text beyond minimal matcher conditions
- real DB behavior and index/constraint semantics
- parser-chain behavior (already locked by json parser contracts)

## Test Strategy
- tiny express app + `express.json({ limit: "1mb" })`
- `requireAuth` stub injects `res.locals.user = { id:"u1" }`
- fake pool handles list/upsert/delete query shapes only
- small `maxPayloadBytes` to trigger deterministic 413 path
