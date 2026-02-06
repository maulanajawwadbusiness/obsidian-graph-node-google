# Report 2026-02-06: Provider Step 8 Endpoint Contracts Lock

## Contract Spec (Explicit)

### 1) POST /api/llm/chat
Response:
- Streaming response body (ReadableStream)
- Content-Type: text/plain; charset=utf-8
- Body: raw text chunks only (no SSE framing, no JSON envelopes)
- Abort: server may stop streaming; client receives partial text

Errors:
- If rejected before streaming begins, response is JSON:
  { ok:false, request_id, code, error }
- If streaming already started, server may end stream without JSON.

### 2) POST /api/llm/paper-analyze
Response:
- JSON

Success:
- { ok:true, request_id, json: <object> }

Failure:
- { ok:false, request_id, code, error }

### 3) POST /api/llm/prefill
Response:
- JSON

Success:
- { ok:true, request_id, prompt }

Failure:
- { ok:false, request_id, code, error }

## Contract Tests (Minimal Script)
File:
- src/server/scripts/test-llm-contracts.mjs
Script:
- Checks chat content-type + no SSE framing + no JSON envelope.
- Checks paper-analyze success shape (ok, request_id, json object).
- Checks prefill success shape (ok, request_id, prompt).
- If auth or insufficient balance blocks success, script can validate error shape instead.

Env:
- LLM_CONTRACT_BASE_URL (default http://localhost:8080)
- LLM_CONTRACT_AUTH_COOKIE (optional auth cookie string)
- LLM_CONTRACT_ALLOW_INSUFFICIENT=true (allow 402 as valid for shape checks)

## Verification Status
- Automated contract script added; not executed in this run.
- No endpoint response shape changes were made.

## Files Changed
- src/server/scripts/test-llm-contracts.mjs
- src/server/package.json
