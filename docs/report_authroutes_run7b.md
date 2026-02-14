# Run 7b Report: Auth Routes Wiring

Date: 2026-02-14
Scope: wire monolith to authRoutes module

## Changes
- Updated `src/server/src/serverMonolith.ts`:
  - Removed inline handlers for:
    - `POST /auth/google`
    - `GET /me`
    - `POST /auth/logout`
  - Added `registerAuthRoutes(app, deps)` call in the same relative route order location.
  - Added `verifyGoogleIdToken` wrapper using `OAuth2Client.verifyIdToken`.
  - Passed `getProfileColumnsAvailable: () => profileColumnsAvailable` into route deps.

## Parity Checklist
- Paths/methods unchanged.
- Cookie options unchanged through cookie helpers:
  - `httpOnly: true`
  - `sameSite: lax` (normalized)
  - `secure` from prod mode
  - `path: /`
  - `maxAge` from session ttl for set-cookie
- `/me` behavior unchanged:
  - no cookie -> `{ ok: true, user: null }`
  - cookie with missing session -> clears cookie, returns `{ ok: true, user: null }`
  - expired session -> deletes session, clears cookie, returns `{ ok: true, user: null }`
- `/auth/logout` behavior unchanged:
  - deletes session when present
  - always clears cookie and returns `{ ok: true }`
- `/auth/google` branch parity retained:
  - missing idToken (400)
  - missing GOOGLE_CLIENT_ID (500)
  - token validation failure (401)
  - token missing subject (401)

## Order Safety
- Webhook-before-CORS invariant untouched.
- CORS placement untouched.
- Startup gate flow untouched (`runStartupGates` before listen).
- `profileColumnsAvailable` still shared runtime state for auth and profile routes.
