# Knife Guide: Google Login Feature

## 1) How It Works (Mental Model)
- Frontend calls `/api/*` on `https://beta.arnvoid.com` (same-site).
- Vercel rewrites `/api/*` to Cloud Run backend.
- Backend verifies Google ID token, writes session to Postgres, sets `arnvoid_session` cookie.
- Frontend bootstraps `GET /me` and stores user in React Context.
- UI reads auth state from `AuthProvider`.

## 2) Where To Change Things Fast (Knife Points)
- Change UI placement:
  - Move `SessionExpiryBanner` mount in `src/playground/GraphPhysicsPlayground.tsx`.
  - Move login UI by relocating `GoogleLoginButton` or its wrapper.
- Change session duration:
  - Backend only. Adjust session TTL logic in `src/server/src/index.ts` or DB policy.
- Change allowed origins:
  - Backend env `ALLOWED_ORIGINS` (comma-separated).
- Change domain / move beta to prod:
  - Update Vercel rewrite and `ALLOWED_ORIGINS`.
  - Update OAuth allowed origins in Google Console.
- Change cookie policy:
  - Backend cookie options in `src/server/src/index.ts` (SameSite, Secure).
- Change Google client id:
  - Frontend `VITE_GOOGLE_CLIENT_ID`
  - Backend `GOOGLE_CLIENT_ID`

## 3) Common Failure Modes + Exact Fixes
- Client ID missing:
  - Symptom: Google button fails, console logs missing client id.
  - Fix: set `VITE_GOOGLE_CLIENT_ID` in frontend env and rebuild.
- GSI origin not allowed:
  - Symptom: GSI 403 with "origin not allowed".
  - Fix: add origin in Google OAuth client config.
- Audience mismatch:
  - Symptom: backend rejects token (verifyIdToken audience error).
  - Fix: ensure backend `GOOGLE_CLIENT_ID` matches frontend client id.
- CORS blocked origin:
  - Symptom: backend error "CORS blocked origin".
  - Fix: include origin in `ALLOWED_ORIGINS`.
- Cookie not set / not sent:
  - Symptom: login ok but `/me` returns null.
  - Fix: `credentials: "include"` on fetch, ensure cookie options match host and secure.
- `/me` returns null unexpectedly:
  - Symptom: user missing after refresh.
  - Fix: check cookie presence, session row in DB, and expiry policy.

## 4) Smoke Tests
### Curl (requires real idToken)
1. Login:
```
curl -i -X POST \
  -H "Content-Type: application/json" \
  -d '{"idToken":"YOUR_ID_TOKEN"}' \
  https://beta.arnvoid.com/api/auth/google
```
2. Check session:
```
curl -i -H "Cookie: arnvoid_session=YOUR_COOKIE" \
  https://beta.arnvoid.com/api/me
```
3. Logout:
```
curl -i -X POST \
  -H "Cookie: arnvoid_session=YOUR_COOKIE" \
  https://beta.arnvoid.com/api/auth/logout
```

### Browser Checklist
1. Open app, click Google login.
2. Confirm Network: `POST /api/auth/google` returns `Set-Cookie`.
3. Confirm `GET /api/me` returns `user`.
4. Refresh page, confirm user still appears.
5. Click logout, confirm `/api/me` returns `user: null`.

### DevTools Checklist
- Application tab -> Cookies: `arnvoid_session` is present.
- Network -> Request headers include `Cookie` for `/api/me`.
- Response headers include `Set-Cookie` on login and clear on logout.

## 5) Do-Not-Do List
- Do not store tokens in localStorage or sessionStorage.
- Do not set CORS origin to `*` with credentials enabled.
- Do not log idTokens or cookie values.
- Do not bypass `/me` as the source of truth.
- Do not embed auth UI deeply in a single screen; keep it movable.
