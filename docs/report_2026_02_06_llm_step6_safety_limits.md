# Report: Step 6 - Server LLM Safety and Limits

Date: 2026-02-06
Scope: Add server-side validation, caps, concurrency, and consistent errors for LLM endpoints.

## Summary
Implemented hard caps and validation for all LLM endpoints, explicit JSON body limit, per-user concurrency limit, consistent error model, and request_id logging. Added validation helpers and limits constants. Streaming endpoint now decides error vs stream before writing.

## Changes

### New files
- src/server/src/llm/limits.ts
- src/server/src/llm/validate.ts

### Updated
- src/server/src/index.ts

## Limits and Validation

### Global
- JSON body limit: 2mb (express.json).
- Per-user concurrency: max 2 concurrent LLM requests. If exceeded, 429 + Retry-After: 5.

### /api/llm/paper-analyze
- Required fields: text (string)
- Optional: nodeCount (number), model (string)
- Caps:
  - text max 80000 chars (413)
  - nodeCount must be 2..12 (400)
  - model must be one of AI_MODELS (400)

### /api/llm/chat
- Required: userPrompt (string), context (object)
- Optional: model, systemPrompt, context fields
- Caps:
  - userPrompt max 4000 chars (413)
  - systemPrompt max 8000 chars (413)
  - recentHistory max 20 items (413)
  - per-message text max 1000 chars (413)
  - documentText max 3000 chars (413)
  - nodeLabel max 200 chars (413)

### /api/llm/prefill
- Required: nodeLabel (string)
- Optional: model, miniChatMessages, content
- Caps:
  - nodeLabel max 200 chars (413)
  - miniChatMessages max 20 (413)
  - per-message text max 1000 chars (413)
  - content.summary max 20000 chars (413)

## Error Model
All errors return:
```
{ ok: false, request_id, code, error }
```
Codes:
- bad_request
- too_large
- unauthorized
- rate_limited
- upstream_error
- timeout
- parse_error

## Observability
- X-Request-Id header on all responses.
- One log line per request completion:
  request_id, endpoint, user_id, model, input_chars, duration_ms, status_code
- No prompt contents logged.

## Streaming Behavior
- /api/llm/chat validates input before streaming.
- If invalid, returns JSON error (no stream).
- If streaming starts, raw text chunks are written (text/plain). No JSON mid-stream.
- Concurrency slot released on completion or client disconnect.

## Notes
- AI model allowlist uses AI_MODELS from src/config/aiModels.ts.
- LLM client timeouts remain at 30s (non-stream) and 90s (stream).

## Manual Verification Plan
- Oversized text -> 413
- Invalid types -> 400
- Open 3 concurrent requests -> 429 on third
- Abort a stream -> slot released, next request succeeds

End of report.
