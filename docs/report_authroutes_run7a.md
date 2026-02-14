# Run 7a Report: Auth Routes Module Add

Date: 2026-02-14
Scope: module add only, no monolith wiring changes

## Added
- `src/server/src/routes/authRoutes.ts`
- Exported:
  - `AuthRouteDeps`
  - `GoogleTokenInfo`
  - `registerAuthRoutes(app, deps)`

## Route Surface Moved Into Module
- `POST /auth/google`
- `GET /me`
- `POST /auth/logout`

## Parity Notes
- Route logic copied from monolith with parity for status codes, body shapes, and log lines.
- `/auth/google` keeps required audience log and missing-client-id branch.
- `/me` keeps null-user contract and cookie clear behavior for missing/expired sessions.
- `/auth/logout` keeps session delete-if-present + always clear-cookie behavior.
- Cookie reads/writes use shared helpers from `src/server/src/server/cookies.ts`.
- `profileColumnsAvailable` behavior remains dependency-driven via `getProfileColumnsAvailable()`.

## Non-Changes
- No route wiring changes in monolith yet.
- No middleware/order changes.
- No profile update route changes.
