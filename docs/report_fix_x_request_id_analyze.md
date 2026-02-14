# Fix Report: Duplicate X-Request-Id in Analyze Insufficient-Balance Branches

Date: 2026-02-14
Scope: `src/server/src/serverMonolith.ts` only (analyze route area)
Status: implemented with minimal diff

## 1. Forensic scan (no behavior change)

Target handler:
- `POST /api/llm/paper-analyze` in `src/server/src/serverMonolith.ts`

Request id source:
- `requestId` is generated in the analyze handler with `crypto.randomUUID()`.
- It is not sourced from request headers.

Duplicate header writes found before fix:
- pre-provider insufficient-balance branch:
  - `res.setHeader("X-Request-Id", requestId);` repeated 3 times
- post-charge insufficient-balance branch:
  - `res.setHeader("X-Request-Id", requestId);` repeated 2 times

Helper behavior check:
- `sendApiError(...)` sets `X-Request-Id` once via `body.request_id`.
- Analyze insufficient-balance branches do not use `sendApiError`, so inline header writes were the duplication source.

## 2. Implemented fix (minimal diff)

File changed:
- `src/server/src/serverMonolith.ts`

Changes:
1. Reduced pre-provider insufficient-balance header writes from 3 to 1.
2. Reduced post-charge insufficient-balance header writes from 2 to 1.
3. No other logic changed.

Preserved behavior:
- same status codes
- same JSON shape
- same audit writes
- same billing logic
- same operational logs

## 3. Verification

## 3.1 Static verification

Command:
```powershell
rg --line-number 'X-Request-Id' src/server/src/serverMonolith.ts
```

Result after fix:
- single analyze insufficient-balance header write sites remain:
  - `src/server/src/serverMonolith.ts:1268`
  - `src/server/src/serverMonolith.ts:1529`
- analyze success path header write remains:
  - `src/server/src/serverMonolith.ts:1594`

No append-based duplication:
```powershell
rg --line-number 'res\.append\("X-Request-Id"|res\.append\("x-request-id"' src/server/src/serverMonolith.ts
```
- no matches.

## 3.2 Build verification

Command:
```powershell
npm run build
```
Run in: `src/server`

Result:
- pass (`tsc` completed with exit code 0).

## 3.3 Runtime verification attempts

Attempted to run local server from this shell:
```powershell
npm run dev
```
Run in: `src/server`

Observed result from this run:
- startup failed with Cloud SQL connector timeout:
  - `[auth-schema] fatal startup failure: Error: [db] timeout after 15000ms during cloud-sql connector setup`

There is an existing listener on `http://localhost:8080` in this environment, but without authenticated cookie access in this session, only unauthorized analyze response could be validated.

Unauthorized probe command run:
```powershell
$tmp = Join-Path $env:TEMP 'analyze_payload.json'; '{"text":"Short test input for analysis.","nodeCount":2}' | Set-Content -Path $tmp -NoNewline -Encoding utf8; curl.exe -s -i -X POST http://localhost:8080/api/llm/paper-analyze -H "Content-Type: application/json" --data-binary "@$tmp"
```

Observed header snippet:
```text
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
```

Note:
- This confirms endpoint reachability only.
- It does not validate analyze insufficient-balance or success paths because they require authenticated session and route execution beyond `requireAuth`.

## 3.4 Exact curl commands for final live check

Insufficient-balance analyze check (with valid auth cookie):
```powershell
curl.exe -s -D - -o NUL -X POST http://localhost:8080/api/llm/paper-analyze -H "Content-Type: application/json" -H "Cookie: arnvoid_session=<SESSION_ID>" --data-binary "{\"text\":\"Short test input for analysis.\",\"nodeCount\":2}"
```

Success analyze check (with valid auth cookie and sufficient balance):
```powershell
curl.exe -s -D - -o NUL -X POST http://localhost:8080/api/llm/paper-analyze -H "Content-Type: application/json" -H "Cookie: arnvoid_session=<SESSION_ID>" --data-binary "{\"text\":\"Short test input for analysis.\",\"nodeCount\":2}"
```

Expected header condition for both:
- exactly one `x-request-id:` line in response headers.

