# Report 2026-02-19: SSE Keepalive For Paper Analyze Through Vercel Proxy

## Scope
- Keep `/api/llm/paper-analyze` alive through Vercel 30s idle timeout without token streaming.
- Preserve existing analyzer behavior: one final JSON payload, existing server timeout budget, existing client timeout and timeout retry loop.

## Root Cause
1. Analyze generation can run long enough to hit Vercel idle timeout when no bytes are sent.
2. Analyze route previously returned only a final JSON body, so proxy could close idle connection before completion.

## Changes

### 1) Backend keepalive SSE lifecycle in analyze route
- File: `src/server/src/routes/llmAnalyzeRoute.ts`
- Added constants and SSE lifecycle:
  - `KEEPALIVE_INTERVAL_MS = 15000`
  - `startSse()`: sets SSE headers and sends `: keepalive` comments every 15s.
  - `stopSse()`: always clears heartbeat interval.
  - `sendSseResult(...)`: sends final `data:` payload and closes stream.
  - `sendSseError(status, payload)`: sends final `data:` payload with embedded `_status`.
- `startSse()` now starts exactly before the long LLM call section.
- All response writes after SSE start now use SSE helpers (success and errors).
- `stopSse()` runs in `finally` before slot/inflight release to avoid leaked intervals.

### 2) Frontend analyze transport switched to SSE reader
- File: `src/ai/paperAnalyzer.ts`
- Added analyze-specific helpers:
  - `resolveAnalyzeUrl(...)`
  - `fetchAnalyzeSse(...)`
- Analyze request in retry loop now uses `fetchAnalyzeSse(...)` instead of `apiPost(...)`.
- Behavior preserved:
  - `ANALYZE_API_TIMEOUT_MS = 120_000`
  - `ANALYZE_TIMEOUT_RETRY_COUNT = 1`
  - timeout classification and retry flow unchanged.
- SSE parsing behavior:
  - ignores keepalive comments
  - parses final `data:` JSON payload
  - reads `_status` when present for post-SSE errors.

### 3) Contract test update for analyze success mode
- File: `src/server/scripts/test-llm-contracts.mjs`
- `testPaperAnalyze()` now accepts either:
  - JSON success payload, or
  - SSE success payload (parses last `data:` frame).

## Response Contract Notes
- Early fast-fail paths before SSE start remain normal JSON + HTTP status.
- After SSE start:
  - HTTP status remains 200 at transport level
  - final semantic status is embedded as `_status` for errors
  - success payload remains `{ ok: true, request_id, json }`.

## Verification
- Frontend build: `npm run build` (repo root) passed.
- Backend build: `npm run build` (`src/server`) passed.
- Backend contracts: `npm run test:contracts` (`src/server`) passed.

## Risks And Mitigations
- Risk: missing interval cleanup can leak timers.
  - Mitigation: `stopSse()` in all send helpers and in route `finally`.
- Risk: SSE payload parse failure client-side.
  - Mitigation: client maps missing/invalid final payload to `502` equivalent failure path.
- Risk: post-SSE status code mismatch.
  - Mitigation: `_status` embedded and consumed by analyzer transport helper.
