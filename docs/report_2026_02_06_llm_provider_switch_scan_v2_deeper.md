# Unified LLM Provider Switch Scan v2 (Deeper)

Date: 2026-02-06
Scope: server-side provider switch feasibility (OpenAI + OpenRouter), no code changes
Inputs: existing scan report + current backend + OpenRouter docs

## 1) Current Backend Contract Summary (Facts)

### Internal functions used by endpoints
- The server LLM client exposes:
  - `generateStructuredJson` (OpenAI Responses API, JSON schema) in `src/server/src/llm/llmClient.ts:153-310`.
  - `generateText` (OpenAI Responses API, non-stream) in `src/server/src/llm/llmClient.ts:313-443`.
  - `generateTextStream` (OpenAI Responses API, streaming) in `src/server/src/llm/llmClient.ts:445-565`.
  - The stream parser yields only `response.output_text.delta` events as raw text chunks. `src/server/src/llm/llmClient.ts:445-531`.

### Endpoint outputs to frontend
- `POST /api/llm/paper-analyze`:
  - Success: `res.json({ ok: true, request_id, json })` in `src/server/src/index.ts:947-949`.
  - Errors are JSON with `{ ok:false, request_id, code, error }` (multiple sendApiError sites). `src/server/src/index.ts:733-875`.
- `POST /api/llm/prefill`:
  - Success: `res.json({ ok: true, request_id, prompt })` in `src/server/src/index.ts:1288-1290`.
  - Errors are JSON with `{ ok:false, request_id, code, error }` or insufficient-rupiah payload. `src/server/src/index.ts:1087-1278`.
- `POST /api/llm/chat`:
  - Streaming: sets `Content-Type: text/plain; charset=utf-8`, writes raw text chunks, ends response. `src/server/src/index.ts:1430-1449`.
  - If pre-stream error, returns JSON error. `src/server/src/index.ts:1455-1475`.

## 2) Provider Interface Proposal (Facts + Implications)

### Proposed server-side Provider interface (matches current needs)
- `generateText(prompt, opts) -> { ok, request_id, text, usage? }`
- `generateTextStream(prompt, opts) -> AsyncGenerator<string>` that yields raw text chunks
- `generateStructuredJson(schema, prompt, opts) -> { ok, request_id, json, usage? }`

### OpenAI provider mapping (facts)
- Already implemented via `src/server/src/llm/llmClient.ts` (OpenAI Responses API) and matches the interface above. `src/server/src/llm/llmClient.ts:153-565`.

### OpenRouter provider mapping (implications)
- Needs a second provider in `src/server/src/llm/` that calls OpenRouter chat completions (`/api/v1/chat/completions`) and normalizes:
  - Non-stream: `choices[0].message.content` -> `text`.
  - Stream: `choices[0].delta.content` -> raw text chunks.
  - Structured: use `response_format` with `json_schema` or `json_object` and parse JSON.
- The provider switch should be server-side because frontend no longer calls OpenAI/OpenRouter directly.

## 3) OpenRouter Transport Details (Evidence)

### Endpoint + request body
- OpenRouter chat completions are sent to `POST /api/v1/chat/completions` with `messages[]`, `model`, `stream` and other params. The request schema and endpoint are documented in the API reference. ?cite?turn1view0?

### Headers
- Required: `Authorization: Bearer <OPENROUTER_API_KEY>`, `Content-Type: application/json`.
- Optional app attribution: `HTTP-Referer`, `X-Title`. ?cite?turn1view0?

### Streaming format
- OpenRouter uses SSE for streaming. Set `stream: true`. ?cite?turn1view0?turn2view3?
- Stream chunks include `choices[0].delta.content` for text deltas. ?cite?turn2view1?
- Mid-stream errors are sent as SSE events with `choices[0].finish_reason: "error"`, HTTP status remains 200. ?cite?turn2view1?turn2view3?

### Usage / cost fields
- Usage info is always included in responses; for streaming it appears in the final chunk. ?cite?turn3view2?turn3view1?
- The `usage` object includes token counts and cost fields (prompt, completion, total, cost). ?cite?turn3view2?

## 4) Structured Output Feasibility (Evidence + Risks)

- OpenRouter supports `response_format` with `json_object` and `json_schema`. ?cite?turn1view0?
- Structured outputs are supported for compatible models; support varies by model and requires checking model capabilities. ?cite?turn1view0?turn0search2?

### Implications for paper-analyze
- Strict mode: allow OpenRouter only for models that support `response_format: { type: "json_schema" }`.
- Fallback mode: use prompt-based JSON + validation + retry if schema is not supported.
- Risk: schema support is model-dependent; without checks, paper-analyze can fail or produce malformed JSON.

## 5) Model Mapping Plan (Evidence)

Define a logical model set for the app:
- `gpt-5.2`, `gpt-5.1`, `gpt-5-mini`, `gpt-5-nano`.

OpenRouter model IDs (from model pages):
- `openai/gpt-5.2` ?cite?turn5view0?
- `openai/gpt-5.1` ?cite?turn7view0?
- `openai/gpt-5-mini` ?cite?turn5view1?
- `openai/gpt-5-nano` ?cite?turn5view2?

Recommendation (no code changes):
- Add a server mapping file, e.g. `src/server/src/llm/modelMap.ts`, with:
  - logical -> provider-specific model IDs
  - provider-specific overrides if needed

## 6) Billing / Usage Implications (Analysis)

- OpenAI Responses: usage available at end of non-stream response (current implementation already reads `usage` in server llm client).
- OpenRouter Chat Completions: usage is always included in the response, and in the final streaming chunk. ?cite?turn3view2?turn3view1?
- If OpenRouter usage is missing (provider anomalies), fallback to word-count estimator should remain in place (already used in server for OpenAI fallback paths).

## 7) Decision Table (Support Matrix)

Endpoint / Capability | OpenAI Provider (current) | OpenRouter Provider (proposed)
- /api/llm/paper-analyze (structured JSON) | OK (Responses API + json_schema) | Partial (only for models supporting response_format json_schema)
- /api/llm/prefill (text) | OK | OK
- /api/llm/chat (stream) | OK (raw text chunks) | OK (SSE -> delta.content) with SSE parsing adapter
- Usage / pricing | OK (usage present or estimator fallback) | OK (usage in response + final chunk; fallback if missing)

## Risks (Evidence-backed)

- Streaming errors are returned mid-stream as SSE events even if HTTP status is 200, which requires a parser that can handle error chunks. ?cite?turn2view1?turn2view3?
- Structured output availability varies by model; if a model does not support `response_format: json_schema`, paper-analyze may break unless a fallback is implemented. ?cite?turn1view0?turn0search2?
- OpenRouter streaming uses SSE; current server stream parser is OpenAI Responses format, so it must be adapted or a separate parser built. ?cite?turn2view1?turn2view3?

## Appendix: Files Scanned (local)
- `src/server/src/llm/llmClient.ts` (OpenAI Responses implementation)
- `src/server/src/index.ts` (LLM endpoints and response shapes)
- `docs/report_2026_02_06_llm_provider_switch_scan.md` (previous scan)
