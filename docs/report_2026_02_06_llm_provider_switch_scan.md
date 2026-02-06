# Unified LLM Provider Scan (OpenAI + OpenRouter)

Date: 2026-02-06
Scope: scan for how the original program selected OpenAI vs OpenRouter and what is needed to restore that switch in the current server-side flow. No code changes.

## Observed Facts

### Frontend: unified client factory still exists (but not in use for prod calls)
- `src/ai/clientTypes.ts` defines `LLMMode = 'openai' | 'openrouter'` and `LLMClient` interface with `generateText`, `generateTextStream`, `generateStructured`. (file: `src/ai/clientTypes.ts`)
- `src/ai/index.ts` exports `createLLMClient(config)` that switches on `mode` and returns either `OpenAIClient` or `OpenRouterClient`. (file: `src/ai/index.ts`)
- `src/config/aiMode.ts` still contains `getAiMode()` with `VITE_AI_MODE` and `window.ARNVOID_AI_MODE` to switch between `mock` and `real`. It does not select between OpenAI vs OpenRouter. (file: `src/config/aiMode.ts`)

### Frontend: OpenAI client uses Responses API
- `src/ai/openaiClient.ts` implements `OpenAIClient` using `https://api.openai.com/v1/responses` for `generateText`, `generateTextStream`, and `generateStructured`. (file: `src/ai/openaiClient.ts`)

### Frontend: OpenRouter client is stubbed
- `src/ai/openrouterClient.ts` is a stub: no API calls, returns fixed strings or throws. It does not implement streaming or structured output. (file: `src/ai/openrouterClient.ts`)

### Frontend call sites no longer use the unified client
- LLM calls now go to server endpoints via `apiPost('/api/llm/*')` in:
  - `src/ai/paperAnalyzer.ts`
  - `src/fullchat/fullChatAi.ts`
  - `src/fullchat/prefillSuggestion.ts`
  These do not use `createLLMClient` and do not use OpenRouter/OpenAI client code.

### Backend: server-side LLM client is OpenAI-only
- `src/server/src/llm/llmClient.ts` calls OpenAI Responses API and has no provider abstraction.
- `src/server/src/index.ts` calls `generateStructuredJson`, `generateText`, `generateTextStream` from `llmClient.ts` directly, so all server LLM traffic is currently OpenAI-only.

## Implications (what is needed to restore a provider switch)

1) The original unified provider switch exists only on the frontend, but frontend no longer calls it.
- To restore provider switching, the new switch must be implemented server-side.

2) OpenRouter is not implemented in the current code.
- The frontend `OpenRouterClient` is a stub and cannot be used for real traffic.
- A server-side OpenRouter provider would need real HTTP calls and streaming parsing.

3) Provider selection should be on the server, not the client.
- Current architecture routes all LLM calls through `/api/llm/*`.
- A unified provider switch should be implemented inside `src/server/src/llm/` and keyed by an env var, e.g. `LLM_PROVIDER=openai|openrouter`.

4) Model naming must be normalized per provider.
- OpenRouter models use names like `openai/gpt-4o` and are different from OpenAI direct model names (`gpt-5.1`, `gpt-5.2`).
- A mapping layer is needed to translate logical models to provider-specific IDs.

5) Streaming format differences must be handled.
- OpenAI Responses streaming yields `response.output_text.delta` events.
- OpenRouter typically uses OpenAI-compatible chat completion streaming (SSE with `data:` frames and `delta` fields) depending on the route. A parser adapter is needed to yield raw text chunks consistently.

6) Pricing + token usage will need provider-specific usage extraction.
- The current rupiah charging uses `usage` fields when available from OpenAI Responses. OpenRouter responses may expose different usage shapes or require counting tokens from output text. The charging logic should handle per-provider usage fields and fallback.

## Risks

- If you flip providers without a real OpenRouter implementation, calls will fail or return stub strings.
- Streaming semantics can diverge and break the frontend streaming consumer if not normalized.
- Token usage for pricing may be missing or inaccurate for OpenRouter without proper parsing.

## Recommended Minimal Server-Side Design (scan-informed)

- Add a server-side provider interface:
  - `generateStructuredJson`, `generateText`, `generateTextStream` (same as today)
- Implement two providers:
  - `openai` (existing `llmClient.ts` logic)
  - `openrouter` (new module using OpenRouter base URL and auth)
- Add a resolver:
  - `getLlmProvider()` reads env var like `LLM_PROVIDER`
  - `getModelForProvider(model, provider)` maps models
- Keep endpoint contract the same: server endpoints remain unchanged for frontend.

## Appendix: Files Scanned
- `src/ai/clientTypes.ts`
- `src/ai/index.ts`
- `src/ai/openaiClient.ts`
- `src/ai/openrouterClient.ts`
- `src/config/aiMode.ts`
- `src/ai/paperAnalyzer.ts`
- `src/fullchat/fullChatAi.ts`
- `src/fullchat/prefillSuggestion.ts`
- `src/server/src/llm/llmClient.ts`
- `src/server/src/index.ts`
