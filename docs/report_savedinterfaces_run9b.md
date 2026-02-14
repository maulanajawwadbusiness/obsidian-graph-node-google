# Run 9b Report: Saved Interfaces Routes Wiring

Date: 2026-02-14
Scope: wire monolith to savedInterfaces routes module

## Changes
- Updated `src/server/src/serverMonolith.ts`:
  - removed inline routes:
    - `GET /api/saved-interfaces`
    - `POST /api/saved-interfaces/upsert`
    - `POST /api/saved-interfaces/delete`
  - removed now-unused monolith helper `toIsoString()`
  - added `registerSavedInterfacesRoutes(app, deps)` with:
    - `getPool`
    - `requireAuth`
    - `listLimit: SAVED_INTERFACES_LIST_LIMIT`
    - `maxPayloadBytes: MAX_SAVED_INTERFACE_PAYLOAD_BYTES`
    - `logger: console`

## Order Parity
- Saved-interfaces registration stays in same relative position:
  - after profile route registration
  - before `/api/rupiah/me`
- Parser chain, webhook-before-cors, CORS order, and startup order unchanged.

## Parity Checklist
- Paths/methods unchanged for all three saved-interfaces routes.
- Validation strings preserved exactly:
  - `clientInterfaceId is required`
  - `title is required`
  - `payloadVersion must be a positive integer`
  - `payloadJson must be an object`
  - `payloadJson is not serializable`
- 413 message preserved exactly:
  - `saved interface payload too large`
- Response shapes preserved:
  - list: `{ ok:true, items }` with mapped keys and ISO/null dates
  - upsert: `{ ok:true }`
  - delete: `{ ok:true, deleted:boolean }`
- Logging strings preserved for list/upsert/delete.
