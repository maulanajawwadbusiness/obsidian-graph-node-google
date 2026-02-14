# Run2b Report: Wire serverMonolith to cookies.ts

Date: 2026-02-14
Scope: move monolith cookie read/set/clear callsites to cookie utilities
Status: completed

## Summary

Updated `src/server/src/serverMonolith.ts` to use cookie utilities from:
- `src/server/src/server/cookies.ts`

Replaced callsites:
- `requireAuth`
- `POST /auth/google`
- `GET /me`
- `POST /auth/logout`

Removed local monolith helpers after full replacement:
- `parseCookies`
- `normalizeSameSite`
- `resolveCookieOptions`
- local `clearSessionCookie`

## Parity Checklist

Cookie name parity:
- unchanged, still sourced from `COOKIE_NAME` (default `arnvoid_session`)

Clear-cookie options parity:
- `httpOnly: true`
- `sameSite: normalizeSameSite(COOKIE_SAMESITE)`
- `secure: isProd`
- `path: "/"`

Set-cookie options parity:
- all clear-cookie options above
- plus `maxAge: SESSION_TTL_MS`

Session read parity:
- still read from `req.headers.cookie`
- still parse via split by `;` and `=` with `decodeURIComponent`

Non-cookie behavior parity:
- route paths unchanged
- middleware order unchanged
- startup gate order unchanged

## Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)
