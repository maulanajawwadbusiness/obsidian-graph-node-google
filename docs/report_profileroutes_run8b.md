# Run 8b Report: Profile Routes Wiring

Date: 2026-02-14
Scope: wire monolith to profileRoutes module

## Changes
- Updated `src/server/src/serverMonolith.ts`:
  - removed inline `POST /api/profile/update` handler
  - added `registerProfileRoutes(app, deps)` call with:
    - `getPool`
    - `requireAuth`
    - `getProfileColumnsAvailable: () => profileColumnsAvailable`
    - `profileDisplayNameMax`, `profileUsernameMax`, `profileUsernameRegex`
  - added import for `registerProfileRoutes`

## Order Parity
- Route registration stays in same relative section:
  - after auth route registration
  - before saved-interfaces routes
- No parser/cors/webhook/startup order changes.

## Parity Checklist
- method/path unchanged: `POST /api/profile/update`
- auth requirement unchanged: `requireAuth`
- gating unchanged: profile columns unavailable returns same `503` body
- validation unchanged:
  - required fields type check
  - displayName whitespace normalization + trim + max length
  - username trim + max length + regex guard
- response payload unchanged on success (`user.sub`, `email`, `name`, `picture`, `displayName`, `username`)
- error mapping unchanged (`400`, `404`, `500`)
