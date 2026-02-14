# Run 8a Report: Profile Routes Module Add

Date: 2026-02-14
Scope: module add only, no monolith wiring changes

## Added
- `src/server/src/routes/profileRoutes.ts`
- Exported:
  - `ProfileRouteDeps`
  - `registerProfileRoutes(app, deps)`

## Route Surface Moved Into Module
- `POST /api/profile/update`

## Parity Notes
- Preserved profile-columns gate:
  - when unavailable returns `503` with `{ ok:false, error:"profile schema not ready; apply migration first" }`
- Preserved validation behavior:
  - `displayName` and `username` must both be strings
  - displayName whitespace normalization + trim + max length
  - username trim + max length + regex guard
  - empty trimmed values map to `null`
- Preserved DB update query and response payload shape.
- Preserved error/status mapping currently used by handler:
  - `400`, `404`, `500`, and success `200`

## Non-Changes
- No monolith wiring changed in this run.
- No middleware ordering changes.
- No auth semantics changes.
