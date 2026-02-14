# Run 2 Report: RequestFlow Header-Order Safety Fix

Date: 2026-02-14
Scope: fix `Retry-After` write ordering in centralized error path
Status: completed, build passing

## 1. Problem Fixed

Before this run, all three LLM routes had this unsafe order in `429` branches:
1. call `sendApiError(...)` (sends JSON body)
2. then call `res.setHeader("Retry-After", "5")`

That risks missing `Retry-After` and header mutation after response send.

## 2. Changes Applied

## 2.1 Central helper signature

Updated:
- `src/server/src/llm/requestFlow.ts`

`sendApiError` now supports optional headers:
- before: `sendApiError(res, status, body)`
- after: `sendApiError(res, status, body, opts?)`

New behavior order:
1. set `X-Request-Id`
2. set optional headers from `opts.headers`
3. send JSON body

This preserves existing response shape while enabling safe pre-send header wiring.

## 2.2 Route dependency type

Updated:
- `src/server/src/routes/llmRouteDeps.ts`

`sendApiError` type now includes optional `opts` with optional `headers` map.

## 2.3 429 callsite fixes

Updated:
- `src/server/src/routes/llmAnalyzeRoute.ts`
- `src/server/src/routes/llmPrefillRoute.ts`
- `src/server/src/routes/llmChatRoute.ts`

Each `429` branch now passes:
- `opts: { headers: { "Retry-After": "5" } }`

Removed all post-send `res.setHeader("Retry-After", "5")` writes.

## 3. Contract Parity Notes

Unchanged by this run:
- status codes
- `code` values in error JSON
- JSON response body shapes
- audit write fields
- request logging fields
- streaming behavior in `/api/llm/chat`

Changed (safety only):
- `Retry-After` header now guaranteed to be set before body send in `429` responses.

## 4. Verification

Command run in `src/server`:
```powershell
npm run build
```

Result:
- pass (`tsc` exit code 0)

Sanity scan:
- `Retry-After` now appears only through helper options in `429` branches.
- no direct `setHeader("Retry-After", ...)` remains in the three LLM route files.
