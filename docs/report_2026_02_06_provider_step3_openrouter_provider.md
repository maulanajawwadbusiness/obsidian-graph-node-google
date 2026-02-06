# Provider Step 3: OpenRouter Provider Implementation

Date: 2026-02-06
Scope: add OpenRouter provider module implementing LlmProvider (no routing switch yet)

## Summary
Added an OpenRouter provider that uses the OpenAI-compatible chat completions API for non-stream, streaming, and structured outputs. Endpoints still route to OpenAI; this provider is ready for step 4 routing changes.

## Endpoints Used
- Base URL: `https://openrouter.ai/api/v1` (override via `OPENROUTER_BASE_URL`)
- Chat completions:
  - `POST /chat/completions`

## Request Shapes
Non-stream:
- `model`
- `messages: [{ role: "user", content: input }]`
- `stream: false`

Stream:
- `model`
- `messages: [{ role: "user", content: input }]`
- `stream: true`

Headers:
- `Authorization: Bearer <OPENROUTER_API_KEY>`
- `Content-Type: application/json`
- Optional: `HTTP-Referer`, `X-Title`

## Streaming Parse Algorithm
- Parse SSE frames separated by double newlines.
- For each `data:` line:
  - JSON parse the payload.
  - Yield `choices[0].delta.content` as raw text.
- Stop on `data: [DONE]`.
- If an error object appears before any content, throw upstream error.
- If an error object appears mid-stream, stop the generator (endpoint will log upstream_error and still charge partial output).

## Structured Output Behavior
OpenRouter provider uses prompt-based JSON:
- Sends schema text in the prompt.
- Parses returned text with `JSON.parse`.
- If parse fails, returns `parse_error`.

Limitation:
- This is best-effort only. For strict schema enforcement, prefer OpenAI provider until model support is confirmed.

## Usage Extraction
- Non-stream: `usage.prompt_tokens` and `usage.completion_tokens` mapped to input/output tokens if present.
- Stream: usage is not read; charging falls back to word-count estimator in existing pipeline.

## Env Vars
- `OPENROUTER_API_KEY` (required)
- `OPENROUTER_BASE_URL` (optional)
- `OPENROUTER_HTTP_REFERER` (optional)
- `OPENROUTER_X_TITLE` (optional)

## Smoke Test Steps (manual)
1) generateText: call provider with a short prompt; verify non-empty text and status ok.
2) generateTextStream: start streaming; verify chunks are raw text (no SSE framing).
3) generateStructuredJson: pass a simple schema; verify JSON.parse succeeds.

No prompts or responses are logged in this report.
