# Feedback Route Verification (Run 3)

## Route contract
- POST `/api/feedback` requires auth.
- GET `/api/feedback` requires auth and admin allowlist.
- POST `/api/feedback/update-status` requires auth and admin allowlist.

## Wiring checks
- Startup now logs `routes registered: feedback=yes/no`.
- Startup now hard-fails if feedback route group is not fully registered.

## Curl proof
1. Health:
   - `curl -i http://localhost:8080/health`
   - Expected: `200 OK` and JSON body with `ok=true`.
2. Feedback without auth:
   - `curl -i -X POST http://localhost:8080/api/feedback -H 'Content-Type: application/json' --data '{"category":"bug","message":"test"}'`
   - Expected: `401 Unauthorized` from `requireAuth`.

## Browser session cookie test
1. Login in frontend using Google auth flow.
2. Open browser devtools and confirm `arnvoid_session` cookie exists for backend domain.
3. Run from terminal:
   - `curl -i -X POST http://localhost:8080/api/feedback -H 'Content-Type: application/json' -H 'Cookie: arnvoid_session=<SESSION_ID>' --data '{"category":"ux","message":"hello"}'`
4. Expected:
   - Authenticated non-admin user: submit endpoint returns success on valid DB.
   - For admin-only routes, add an email in `ADMIN_EMAIL_ALLOWLIST` and retry GET/update-status.

## Notes
- In DB-missing dev mode, route presence is still proven by status behavior (`401` on protected route), avoiding misleading `404` wiring failures.
