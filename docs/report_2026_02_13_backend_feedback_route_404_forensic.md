# Backend Feedback Route 404 Forensic Report (Run 1)

## Scope
- Investigate why frontend POST to `/api/feedback` returned `Cannot POST /api/feedback`.
- Prove active backend entrypoint and route registration state.

## What is the backend entrypoint
- `src/server/src/index.ts` is the backend entrypoint used by `npm run dev` and `npm run start` from `src/server`.
- It imports `./serverMonolith`, which creates the Express app, registers routes, and starts listening.

## Findings
1. Feedback routes are present in source and registered on the Express app:
   - `POST /api/feedback`
   - `GET /api/feedback`
   - `POST /api/feedback/update-status`
2. Added startup diagnostics now print:
   - `entrypoint` path and `port`
   - `feedback` route registration yes/no
   - DB bootstrap fail mode (`fatal` vs `degraded`)
3. Observed runtime output in local dev:
   - `entrypoint=/workspace/obsidian-graph-node-google/src/server/src/index.ts`
   - `port=8080`
   - `routes registered: feedback=yes`
   - server continued in degraded mode when DB env missing
4. Live curl proof while server running:
   - `POST /api/feedback` returns `401 unauthorized` when not logged in (expected for `requireAuth`)
   - Not a 404 on this backend process.

## Root cause of prior `Cannot POST /api/feedback`
The real backend process that contains feedback routes was not the process serving the request at that moment. The route is registered in the active code path (`index.ts` -> `serverMonolith.ts`) and responds as `401` when reached without session cookie.

Given this evidence, the previous `Cannot POST /api/feedback` came from hitting a different server/app instance on the same URL/port path (or hitting backend when this process was not actually running).

## Verification commands used
- `rg -n "express\(|app\.post\(\"/api/feedback|listen\(" src/server/src/serverMonolith.ts`
- `npm run dev` (from `src/server`)
- `curl -i http://localhost:8080/health`
- `curl -i -X POST http://localhost:8080/api/feedback -H 'Content-Type: application/json' --data '{"category":"bug","message":"test"}'`
