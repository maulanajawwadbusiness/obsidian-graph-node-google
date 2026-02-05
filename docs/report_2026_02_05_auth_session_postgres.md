# Report: Auth Sessions in Postgres (2026-02-05)

## Summary
Switched session storage from memory to Postgres and hardened cookie + token verification behavior.

## Changes
- /auth/google now verifies ID tokens with google-auth-library, upserts the user, inserts a session row, and sets the session cookie.
- /me now reads the cookie, joins sessions to users, and returns ok true with user or null.
- /auth/logout now deletes the session row and clears the cookie with res.clearCookie using the same attributes.
- Cookie logic now uses isProd() (K_SERVICE or NODE_ENV=production) to decide Secure.

## Cookie Policy
- httpOnly: true
- sameSite: lax (default)
- secure: true in prod, false on localhost unless overridden by SESSION_COOKIE_SECURE
- path: /

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

### E) Verify logout clears cookie and session
1) Trigger logout in the app (or call POST /auth/logout from the console).
2) In DevTools -> Network, inspect the /auth/logout response headers.
Expected:
- Set-Cookie clears arnvoid_session (expires in the past)
3) Call /me again.
Expected:
- Status 200
- Body: {"ok":true,"user":null}

## Deploy Command (Laptop)
From repo root:

```powershell
gcloud run deploy arnvoid-api \
  --source src/server \
  --region asia-southeast2 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances arnvoid-project:asia-southeast2:arnvoid-postgres \
  --set-env-vars INSTANCE_CONNECTION_NAME=REPLACE_ME,DB_USER=REPLACE_ME,DB_PASSWORD=REPLACE_ME,DB_NAME=REPLACE_ME,GOOGLE_CLIENT_ID=REPLACE_ME,SESSION_COOKIE_SAMESITE=lax
```

If Cloud Run complains about base image resolution, add:

```powershell
--clear-base-image
```

## Notes
- Token validation no longer uses tokeninfo.
- isProd() is true when K_SERVICE is set or NODE_ENV is production.
- Do not share idToken values in chat. Use DevTools to verify Set-Cookie and response bodies.
