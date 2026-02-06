# Report: Step 3 - Server-side LLM Client Module (Responses API)

Date: 2026-02-06
Scope: Implement reusable server LLM client module only. No endpoints. No frontend changes.

## Summary
Implemented a single server-side LLM client module that wraps OpenAI Responses API for:
- structured JSON schema output
- plain text output
- streaming text output (raw delta chunks)

This module is intended for Step 4 endpoint wiring and matches the v2 sharp API surface spec.

## Files Changed
- Added: src/server/src/llm/llmClient.ts

## Implementation Details

### Module exports
- generateStructuredJson(opts)
  - Inputs: { model, input, schema, timeoutMs? }
  - Returns: { ok: true, request_id, json } or { ok: false, request_id, code, error, status? }
- generateText(opts)
  - Inputs: { model, input, timeoutMs? }
  - Returns: { ok: true, request_id, text } or standard error
- generateTextStream(opts)
  - Inputs: { model, input, timeoutMs? }
  - Returns: AsyncGenerator<string> with request_id attached
  - Yields raw text deltas only (no JSON framing)

### Provider and endpoint
- Uses OpenAI Responses API via fetch.
- Base URL defaults to https://api.openai.com/v1/responses.
- Can be overridden by env var OPENAI_RESPONSES_URL.
- Uses env var OPENAI_API_KEY for auth.

### Observability
- One log line per request at end:
  - request_id, kind, model, input_chars, duration_ms, status
- No prompt or response contents are logged.

### Timeouts
- Default: 30s for non-streaming, 90s for streaming.
- AbortController enforced for all requests.
- Streaming abort throws a typed LlmStreamError containing standard error shape.

### Error Model
Standardized error object for endpoints to reuse:
```
{ ok: false, request_id, code, error, status? }
```
Codes: bad_request, unauthorized, upstream_error, timeout, parse_error.

### Structured JSON schema output
- Supports OpenAI Responses API json_schema via text.format.
- Parses output_text or output array; returns parse_error if empty or invalid JSON.

### Streaming
- Parses Responses API stream frames and yields ONLY response.output_text.delta chunks.
- Ignores non-text event types and framing.

## Commit
- server: add llm client module (responses api)

## Notes / Followups
- No endpoints were added in this step (per requirement).
- Frontend call sites remain unchanged.
- This module is ready to be called by Step 4 endpoints:
  - /api/llm/paper-analyze
  - /api/llm/chat
  - /api/llm/prefill

End of report.
