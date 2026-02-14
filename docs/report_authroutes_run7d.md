# Run 7d Report: Auth Google Contract Guard

Date: 2026-02-14
Scope: deterministic guard for `/auth/google` success and failure matrix

## Added
- `src/server/scripts/test-auth-google-contracts.mjs`
- npm script `test:auth-google-contracts`

## What This Guard Locks
- `POST /auth/google` missing idToken branch:
  - non-2xx
  - `{ ok:false, error:<string> }`
  - no session cookie set
- `POST /auth/google` invalid token branch:
  - non-2xx
  - `{ ok:false, error:<string> }`
  - no session cookie set
- `POST /auth/google` success branch:
  - `200` and `{ ok:true, user:{...} }`
  - stable user identity field `user.sub`
  - session cookie set with stable flags:
    - cookie name present
    - HttpOnly
    - Path=/
    - SameSite=Lax
    - Max-Age or Expires present
- follow-up `GET /me` using returned cookie:
  - `200`
  - `{ ok:true, user:not-null }`
- prod cookie variant (`isProd=true`) sets `Secure` cookie flag
- profile columns toggle variant (`getProfileColumnsAvailable=false`) still allows successful auth flow

## What This Guard Intentionally Does Not Lock
- exact full error message strings across all branches
- full SQL semantics and relational DB behavior
- Google SDK behavior itself (verification is stubbed)
- exact log text matching

## Test Strategy
- tiny express app with `express.json({ limit: "1mb" })`
- `registerAuthRoutes(app, deps)` with stubbed dependencies
- in-memory fake pool that recognizes only auth route query shapes:
  - users upsert
  - sessions insert
  - sessions plus users select for `/me`
  - sessions delete
- no runtime code changes; test-only contract lock
