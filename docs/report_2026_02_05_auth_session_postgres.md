# Report: Auth Sessions in Postgres (2026-02-05)

## Summary
Switched session storage from memory to Postgres and hardened cookie + token verification behavior.

## Changes
- /auth/google now verifies ID tokens with google-auth-library, upserts the user, inserts a session row, and sets the session cookie.
- /me now reads the cookie, joins sessions to users, and returns ok true with user or null.
- /auth/logout now deletes the session row and clears the cookie.
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

Suggested SQL (if not already applied):

```sql
alter table sessions
  alter column user_id type bigint;

alter table sessions
  add constraint sessions_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;

alter table sessions
  alter column id type uuid using id::uuid;
```

## Manual Test Checklist (Exact Steps)
1) Build and start backend

```powershell
cd C:\Users\maulana\Downloads\obsidian-graph-node-google\src\server
npm install
npm run build
npm run start
```

2) Verify /me with no cookie

```powershell
curl.exe -i http://localhost:8080/me
```
Expected:
- Status 200
- Body: {"ok":true,"user":null}

3) Verify login sets cookie
- Open the frontend in a browser.
- Open DevTools > Network.
- Click GoogleLoginButton and complete Google login.
- Find the POST /auth/google request and copy the idToken from the request payload.

```powershell
curl.exe -i -X POST http://localhost:8080/auth/google \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"PASTE_ID_TOKEN_HERE\"}"
```
Expected:
- Status 200
- Response contains ok true and user object
- Response headers include Set-Cookie: arnvoid_session=...

4) Verify /me after login
- Copy the Set-Cookie value from step 3.

```powershell
curl.exe -i http://localhost:8080/me \
  -H "Cookie: arnvoid_session=PASTE_SESSION_ID"
```
Expected:
- Status 200
- Body: {"ok":true,"user":{...}}

5) Verify logout clears session

```powershell
curl.exe -i -X POST http://localhost:8080/auth/logout \
  -H "Cookie: arnvoid_session=PASTE_SESSION_ID"
```
Expected:
- Status 200
- Set-Cookie clears arnvoid_session
- The session row is deleted in Postgres

## Deploy Command (Laptop)
From repo root:

```powershell
gcloud run deploy arnvoid-api \
  --source src/server \
  --region asia-southeast2 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars INSTANCE_CONNECTION_NAME=REPLACE_ME,DB_USER=REPLACE_ME,DB_PASSWORD=REPLACE_ME,DB_NAME=REPLACE_ME,GOOGLE_CLIENT_ID=REPLACE_ME,SESSION_COOKIE_SAMESITE=lax
```

## Notes
- Token validation no longer uses tokeninfo.
- isProd() is true when K_SERVICE is set or NODE_ENV is production.
