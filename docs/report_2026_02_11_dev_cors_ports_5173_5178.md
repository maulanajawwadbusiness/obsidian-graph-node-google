# Report 2026-02-11: Dev CORS Default Port Range Expansion (5173-5178)

## Summary
Expanded backend default dev CORS origins from only port 5173 to ports 5173 through 5178 for both localhost and 127.0.0.1.

## Problem
Local frontend dev servers may auto-shift off 5173 (for example 5174 or 5175) when the default port is occupied. The previous default CORS allowlist only included:
- http://localhost:5173
- http://127.0.0.1:5173

Result: local auth/session requests could fail with CORS blocked origin when Vite moved to another nearby port.

## Changes
File changed:
- src/server/src/serverMonolith.ts

Implementation:
- Added `DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178]`.
- Replaced single-port `DEFAULT_DEV_ORIGINS` with a generated list for both hosts:
  - http://localhost:<port>
  - http://127.0.0.1:<port>

No other CORS behavior changed.

## Contract and Behavior
Unchanged behavior:
- `ALLOWED_ORIGINS` env override remains highest priority.
- `credentials: true` remains enabled.
- Production/beta default origin remains unchanged.

Changed behavior:
- When `ALLOWED_ORIGINS` is empty, local defaults now allow both hosts across ports 5173-5178.

## Verification
Static verification:
- Confirmed `DEFAULT_DEV_ORIGINS` now derives from explicit DEV_PORTS [5173..5178].

Runtime verification guidance:
1. Start backend.
2. Send requests to `/me` with Origin headers:
   - Expect allow for localhost and 127.0.0.1 on 5173-5178.
   - Expect block for 5179 and unrelated origins.
3. Run frontend on any allowed port in range and verify Google login path no longer fails due to local CORS origin mismatch.

## Risk
Low risk.
- Scope limited to local default CORS origins.
- No route, auth cookie, or session logic changes.
