# Provider Step 2: OpenAI Provider Adapter

Date: 2026-02-06
Scope: wrap OpenAI client as a formal provider implementation (no routing changes)

## Summary
Added a concrete OpenAI provider that implements the LlmProvider interface, plus a provider getter. Endpoints now call the provider methods but still use OpenAI for all requests. Policy selection remains log-only until OpenRouter is implemented.

## Files Changed
- `src/server/src/llm/providers/openaiProvider.ts`
- `src/server/src/llm/getProvider.ts`
- `src/server/src/index.ts`

## Behavior Notes
- Response shapes and request_id behavior are unchanged.
- Provider policy logs now include `actual_provider=openai`.
- Routing is still fixed to OpenAI until step 3.

## Smoke Test Notes
- Not run (no tests executed in this step).
