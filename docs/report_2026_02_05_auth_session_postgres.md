# Report: Auth Sessions in Postgres (2026-02-05)

## Summary
Switched session storage from memory to Postgres and hardened CORS, cookie handling, and token verification.

## Changes
- Replaced custom CORS middleware with cors package and default dev origins.
- /auth/google verifies ID tokens with google-auth-library, upserts the user, inserts a session row, and sets the session cookie.
- /me reads the cookie, joins sessions to users, and clears stale or expired cookies.
- /auth/logout deletes the session row and clears the cookie using matching attributes.
- Cookie logic uses isProd() (K_SERVICE or NODE_ENV=production) to decide Secure.

## Cookie Policy
- httpOnly: true
- sameSite: lax (default for same-site)
- secure: true in prod, false on localhost unless overridden by SESSION_COOKIE_SECURE
- path: /

### Same-Site vs Cross-Site
- Same-site (frontend and backend on same site): SameSite=lax is correct.
- Cross-site (different domains): set SESSION_COOKIE_SAMESITE=none and SESSION_COOKIE_SECURE=true.

CSRF note: If we ever set SameSite=None, add CSRF protection for state-changing routes (logout, etc).

## CORS Policy
- Uses cors package with credentials true.
- Allowed origins:
  - If ALLOWED_ORIGINS is set, only those origins are allowed.
  - Otherwise defaults to http://localhost:5173 and http://127.0.0.1:5173.
- OPTIONS always returns 204 with proper headers.

## Env Vars (Dev vs Prod)
Dev:
- ALLOWED_ORIGINS is optional (defaults to localhost:5173 and 127.0.0.1:5173)
- NODE_ENV can be unset or development
- SESSION_COOKIE_SAMESITE=lax
- SESSION_COOKIE_SECURE=false (optional; auto false when not prod)

Prod (Cloud Run):
- K_SERVICE is set automatically
- GOOGLE_CLIENT_ID is required
- ALLOWED_ORIGINS is required if frontend is on a different origin
  - Example: ALLOWED_ORIGINS=https://frontend.example.com
- SESSION_COOKIE_SAMESITE=lax (default; set to none only for cross-site)
- SESSION_COOKIE_SECURE=true (or leave unset to use prod default)

## Prod Deploy Checklist
- Set GOOGLE_CLIENT_ID
- Set ALLOWED_ORIGINS
- Set SESSION_COOKIE_SAMESITE (optional; only if cross-site)
- Confirm frontend fetch uses credentials:"include" for /auth/google, /me, /auth/logout

## Schema Expectations
- users.id is BIGSERIAL (bigint)
- sessions.user_id is BIGINT with FK: sessions.user_id REFERENCES users(id) ON DELETE CASCADE
- sessions.id is UUID and the server uses crypto.randomUUID()

### Confirm Actual Types (Run These Locally)

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'users' and column_name = 'id';

select column_name, data_type
from information_schema.columns
where table_name = 'sessions' and column_name in ('id', 'user_id');
```

### Apply Only If Needed
- If sessions.user_id is not BIGINT:

```sql
alter table sessions
  alter column user_id type bigint;
```

- If sessions.user_id FK is missing:

```sql
alter table sessions
  add constraint sessions_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;
```

- If sessions.id is not UUID:

```sql
alter table sessions
  alter column id type uuid using id::uuid;
```

## Manual Verification Checklist (No Credential Sharing)

### A) Build and start backend

```powershell
cd C:\Users\maulana\Downloads\obsidian-graph-node-google\src\server
npm install
npm run build
npm run start
```

### B) Verify /me with no cookie

```powershell
curl.exe -i http://localhost:8080/me
```
Expected:
- Status 200
- Body: {"ok":true,"user":null}

### C) Verify login sets cookie (no token sharing)
1) Open frontend in browser.
2) Open DevTools -> Network.
3) Click GoogleLoginButton and complete Google login.
4) Click the POST /auth/google request.
5) Inspect Response Headers -> Set-Cookie.
Expected:
- Set-Cookie contains arnvoid_session=...; HttpOnly; SameSite=Lax; Path=/
- Secure is present in Cloud Run, absent on localhost.

### D) Verify /me after login
1) Refresh the page (or call /me from the app).
2) In DevTools -> Network, inspect the /me response.
Expected:
- Status 200
- Body: {"ok":true,"user":{...}}

### E) Verify expired or missing session clears cookie
1) Manually delete the session row in Postgres for the current cookie.
2) Call /me again.
Expected:
- Status 200
- Body: {"ok":true,"user":null}
- Response headers include Set-Cookie that clears arnvoid_session

### F) Verify logout clears cookie and session
1) Trigger logout in the app (or call POST /auth/logout from the console).
2) In DevTools -> Network, inspect the /auth/logout response headers.
Expected:
- Set-Cookie clears arnvoid_session (expires in the past)
3) Call /me again.
Expected:
- Status 200
- Body: {"ok":true,"user":null}

### Paste Results
Please paste only:
- Status codes
- Response headers
- JSON bodies
Do not paste idToken or cookies.

## Deploy Command (Laptop)
From repo root:

```powershell
gcloud run deploy arnvoid-api \
  --source src/server \
  --region asia-southeast2 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances arnvoid-project:asia-southeast2:arnvoid-postgres \
  --set-env-vars INSTANCE_CONNECTION_NAME=REPLACE_ME,DB_USER=REPLACE_ME,DB_PASSWORD=REPLACE_ME,DB_NAME=REPLACE_ME,GOOGLE_CLIENT_ID=REPLACE_ME,SESSION_COOKIE_SAMESITE=lax,ALLOWED_ORIGINS=https://frontend.example.com
```

If Cloud Run complains about base image resolution, add:

```powershell
--clear-base-image
```

## Notes
- Token validation does not use tokeninfo.
- isProd() is true when K_SERVICE is set or NODE_ENV is production.
- Do not share idToken values in chat.
