## Report: Vercel Proxy CORS Fix (beta.arnvoid.com)

Date: 2026-02-05

### Summary
- Login on `https://beta.arnvoid.com` now succeeds via Vercel `/api` rewrite.
- Root cause was backend CORS blocking origin `https://beta.arnvoid.com`.

### Fix
- Backend CORS allowlist now includes `https://beta.arnvoid.com` by default when `ALLOWED_ORIGINS` is empty.
- CORS still allows localhost dev origins.
- Blocked origins are logged without leaking secrets.

### Files
- `src/server/src/index.ts`

### Notes
- Vercel rewrite: `/api/*` -> Cloud Run backend.
- Frontend uses `VITE_API_BASE_URL=/api` with `credentials: "include"`.
