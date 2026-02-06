# LLM Server API Surface v2 (Sharp) - 2026-02-06

Scope: Scan only. No code changes. Evidence is based on repo files and prior reports:
- docs/report_2026_02_06_llm_server_api_surface.md
- docs/report_2026_02_06_client_llm_call_inventory.md

This report defines minimal server endpoints that mirror current client LLM usage with audit-grade schemas, validation, error models, and streaming specifics.

## Facts

### A) Models (AI_MODELS)
- AI model IDs are defined in src/config/aiModels.ts:
  - CHAT: gpt-5.1
  - PREFILL: gpt-5-nano
  - ANALYZER: gpt-5.2
Evidence: src/config/aiModels.ts:6-24.

### B) Client usage: where calls occur
- paperAnalyzer calls client.generateStructured with JSON schema output. Evidence: src/ai/paperAnalyzer.ts:42-67; 118-186.
- fullChatAi calls client.generateTextStream (streaming). Evidence: src/fullchat/fullChatAi.ts:35-99.
- prefillSuggestion calls client.generateText (non-streaming). Evidence: src/fullchat/prefillSuggestion.ts:85-133.
- LLM client uses OpenAI Responses API via fetch in OpenAIClient. Evidence: src/ai/openaiClient.ts:18-49; 170-195; 260-291.
- OpenRouterClient is stubbed and does not send real requests. Evidence: src/ai/openrouterClient.ts:13-40.

### C) How streaming is consumed in UI
- fullChatAi yields text chunks from AsyncGenerator and appends to accumulated text. Evidence: src/fullchat/fullChatAi.ts:89-99.
- FullChatStore consumes the AsyncGenerator and updates streaming message text every ~32ms. Evidence: src/fullchat/FullChatStore.tsx:121-143; 132-136.
- The UI expects raw text chunks, not SSE framing or NDJSON; it treats each yielded chunk as string delta. Evidence: src/fullchat/fullChatAi.ts:89-99; src/fullchat/FullChatStore.tsx:121-143.

## Implications
- Server streaming must deliver raw text chunks to the frontend in a form that can be consumed as an AsyncGenerator of strings, with minimal client changes. Evidence: src/fullchat/fullChatAi.ts:89-99; src/fullchat/FullChatStore.tsx:121-143.
- Endpoint response shapes must match existing frontend expectations to avoid refactors.
  - Analyzer expects { paperTitle, points, links }. Evidence: src/ai/paperAnalyzer.ts:171-186.
  - Prefill expects a single string (today) after sanitizeOutput; for server, return { prompt: string } and update client to use it. Evidence: src/fullchat/prefillSuggestion.ts:123-193.

## Risks
- If server streaming returns SSE frames instead of raw text chunks, the current client code will append the literal frame text (including event metadata) to the UI. Evidence: src/fullchat/fullChatAi.ts:89-99.
- If server returns a different JSON shape, client mapping will fail or silently produce empty results. Evidence: src/ai/paperAnalyzer.ts:171-186; src/fullchat/prefillSuggestion.ts:123-193.

## Endpoint Definitions (Audit-Grade)

### Common Contract (All Endpoints)

Auth requirement
- Must require cookie session auth and behave like current requireAuth: if no/invalid session, return HTTP 401 with { ok: false, error: "unauthorized" }.
Evidence for requireAuth behavior: src/server/src/index.ts:155-182.

Error model (consistent for all endpoints)
```
{
  ok: false,
  error: string,
  code?: string,
  request_id: string
}
```
- ok: false for all error responses.
- error: short message (no sensitive data).
- code: optional stable error code (e.g., "bad_request", "unauthorized", "upstream_error", "timeout").
- request_id: generated per request for tracing.

Observability
- Log request_id, endpoint name, status, latency, and payload sizes only (no prompt contents). Example log fields:
  - request_id, user_id, endpoint, model, input_chars, history_count, status, duration_ms.
- Do not log prompt text or user content.

Versioning strategy
- Response envelopes must be forward-compatible: add optional fields only; never remove or rename existing fields.
- For requests, add new optional fields with safe defaults; do not make new required fields without version bump.
- If breaking changes become necessary, add a v2 path (e.g., /api/llm/v2/chat) rather than altering v1.

## 1) POST /api/llm/paper-analyze

### Request JSON schema (exact)
```
{
  text: string,              // required
  nodeCount?: number         // optional, default 5, clamp to [2, 12]
}
```
Defaults and rules:
- If nodeCount missing, default to 5. Evidence for client default logic: src/ai/paperAnalyzer.ts:42-45.
- Clamp nodeCount to [2, 12] to match current client bounds. Evidence: src/ai/paperAnalyzer.ts:42-45.
- Truncate text to first 6000 chars to match current client behavior. Evidence: src/ai/paperAnalyzer.ts:46-48.

### Validation rules + hard caps
- text required, non-empty string.
- max document text length (pre-truncate): 200000 chars; then truncate to 6000 for prompt construction (keep consistent UI behavior). Rationale: protects server from oversized payloads while matching current prompt length. Evidence for current truncation: src/ai/paperAnalyzer.ts:46-48.
- nodeCount integer only.

### Model call (server-side)
- Use model AI_MODELS.ANALYZER (gpt-5.2). Evidence: src/ai/paperAnalyzer.ts:162-166; src/config/aiModels.ts:20-24.
- Use JSON schema identical to current client. Evidence: src/ai/paperAnalyzer.ts:118-155.

### Response JSON shape (exact)
```
{
  ok: true,
  request_id: string,
  paperTitle?: string,
  points: Array<{ index: number; title: string; summary: string }>,
  links: Array<{ fromIndex: number; toIndex: number; type: string; weight: number; rationale: string }>
}
```
Mapping must match current client mapping. Evidence: src/ai/paperAnalyzer.ts:171-186.

## 2) POST /api/llm/chat (streaming)

### Request JSON schema (exact)
```
{
  userPrompt: string,               // required
  context: {
    nodeLabel?: string | null,
    documentText?: string | null,
    documentTitle?: string | null,
    recentHistory?: Array<{ role: 'user' | 'ai'; text: string }>
  }
}
```
Evidence for context fields: src/fullchat/fullChatAi.ts:158-185; src/fullchat/FullChatbar.tsx:687-692.

### Validation rules + hard caps
- userPrompt: required, non-empty, max 4000 chars.
- context.documentText: optional, max 3000 chars (client already truncates to 3000 in buildSystemPrompt). Evidence: src/fullchat/fullChatAi.ts:169-172.
- recentHistory: optional array, max 10 items (matches current usage in FullChatbar). Evidence: src/fullchat/FullChatbar.tsx:691-692.
- recentHistory text per item: max 1000 chars, truncate if longer.

### Model call (server-side)
- Use model AI_MODELS.CHAT (gpt-5.1). Evidence: src/fullchat/fullChatAi.ts:24-27; src/config/aiModels.ts:11-12.
- Construct prompt exactly like client:
  - system prompt from buildSystemPrompt
  - fullPrompt = systemPrompt + "\n\nUSER PROMPT:\n" + userPrompt
Evidence: src/fullchat/fullChatAi.ts:73-75; 158-185.

### Streaming strategy (exact)
Current client expects raw text chunks from an AsyncGenerator, not SSE frames. Evidence: src/fullchat/fullChatAi.ts:89-99; src/fullchat/FullChatStore.tsx:121-143.

Recommended server transport to minimize client changes:
- Use fetch ReadableStream with Content-Type: text/plain; charset=utf-8
- Stream raw UTF-8 text chunks with no framing.
- Each chunk is a partial delta string.
- End stream by closing the response.

If SSE is required by infra, then the frontend must be updated to parse SSE and yield only the data payload. That is a client change.

### Response shape (exact)
- Streaming response with raw text chunks.
- On error before stream starts, return JSON error with common error model.

## 3) POST /api/llm/prefill

### Request JSON schema (exact)
```
{
  nodeLabel: string,                          // required
  miniChatMessages?: Array<{ role: 'user' | 'ai'; text: string }>,
  content?: { title: string; summary: string } | null
}
```
Evidence for PrefillContext: src/fullchat/prefillSuggestion.ts:13-18; 149-170.

### Validation rules + hard caps
- nodeLabel required, non-empty, max 200 chars.
- miniChatMessages: optional, max 4 items (matches buildRefinePacket). Evidence: src/fullchat/prefillSuggestion.ts:157-164.
- message text per item: max 300 chars (matches current truncation). Evidence: src/fullchat/prefillSuggestion.ts:162-164.
- content.summary: optional, max 150 chars (matches buildRefinePacket slice). Evidence: src/fullchat/prefillSuggestion.ts:153-155.

### Model call (server-side)
- Use model AI_MODELS.PREFILL (gpt-5-nano). Evidence: src/fullchat/prefillSuggestion.ts:115-118; src/config/aiModels.ts:14-18.
- Use system prompt and buildRefinePacket exactly as client. Evidence: src/fullchat/prefillSuggestion.ts:101-111; 149-170.

### Response JSON shape (exact)
```
{
  ok: true,
  request_id: string,
  prompt: string
}
```
Client currently expects a string returned by generateText and then sanitizes it. Evidence: src/fullchat/prefillSuggestion.ts:123-193.

## Compatibility Notes (client changes required, do not implement here)
- Replace client-side LLM calls with fetch to these endpoints:
  - src/ai/paperAnalyzer.ts
  - src/fullchat/fullChatAi.ts
  - src/fullchat/prefillSuggestion.ts
Evidence for current call sites: src/ai/paperAnalyzer.ts:42-67; src/fullchat/fullChatAi.ts:35-99; src/fullchat/prefillSuggestion.ts:85-133.
- If server uses SSE framing, update fullChatAi to parse SSE and yield only data payloads. Evidence: src/fullchat/fullChatAi.ts:89-99.

## Endpoint Error Handling (proposed consistent behavior)
- 400: validation failure (missing/invalid fields)
- 401: no session or invalid session
- 502: upstream model error
- 504: model timeout

Each error response must follow the common error model with request_id.

End of report.
