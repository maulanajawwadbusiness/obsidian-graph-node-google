# Report 2026-02-13: Local dev ports and feedback route reachability

## Problem
- Browser calls to `http://localhost:8080/api/feedback` were returning HTML `Cannot POST /api/feedback`.
- Route scan in source shows feedback endpoints exist in backend code.
- Root mismatch is process ownership of port 8080 in local dev.

## Source of truth (code)
- Backend entrypoint is `src/server/src/index.ts` and imports `./serverMonolith`.
- Feedback routes are registered in `src/server/src/serverMonolith.ts`:
  - `POST /api/feedback`
  - `GET /api/feedback`
  - `POST /api/feedback/update-status`
- Vite proxy wiring exists in `vite.config.ts` and forwards `/api` when `VITE_DEV_API_PROXY_TARGET` is an http(s) URL.

## Deterministic local routing model
Use split ports in local dev to remove ambiguity:
- Backend: `http://localhost:8081`
- Frontend: `http://localhost:8080`
- Frontend env:
  - `VITE_API_BASE_URL=/api`
  - `VITE_DEV_API_PROXY_TARGET=http://localhost:8081`

Behavior:
- Browser calls `/api/*` to frontend origin (`:8080`).
- Vite proxies `/api/*` to backend (`:8081`) while preserving `/api` prefix.

## Backend startup safety for this mismatch
`src/server/src/serverMonolith.ts` startup now supports a dev degraded mode.
- In dev, if DB/schema readiness fails at startup, server still binds the HTTP port.
- This guarantees route existence checks return route responses (401/500) instead of connection failure.
- Disable degraded startup by setting `ALLOW_DEV_START_WITHOUT_DB=0`.

## Verified commands and outputs
1) Backend direct:
- `curl -i http://localhost:8081/api/feedback`
- Result: `HTTP/1.1 401 Unauthorized` (not 404)

2) Via frontend proxy:
- `curl -i http://localhost:8080/api/feedback`
- Result: `HTTP/1.1 401 Unauthorized` (same behavior, proxied)

## Dev runbook
1. Start backend:
- `cd src/server`
- `PORT=8081 npm run dev`

2. Start frontend:
- from repo root:
- `VITE_API_BASE_URL=/api VITE_DEV_API_PROXY_TARGET=http://localhost:8081 npm run dev -- --port 8080`

3. Quick route check:
- `curl -i http://localhost:8081/api/feedback`
- `curl -i http://localhost:8080/api/feedback`
