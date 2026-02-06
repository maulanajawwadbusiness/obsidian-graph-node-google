# Report 2026-02-06: Real Token Step 1 Provider Usage Extraction

## Summary
- Added normalized provider usage helpers and unified usage capture for OpenAI and OpenRouter.
- Streaming providers now expose provider usage (when available) via a usage promise.
- UsageTracker finalizes using provider usage when present, else falls back to word-count estimates.

## New Helpers
Location:
- src/server/src/llm/usage/providerUsage.ts

normalizeUsage(raw):
- Accepts multiple shapes (input_tokens/output_tokens/total_tokens, prompt_tokens/completion_tokens, total_tokens only).
- Validates integers >= 0, fills total when missing.

mergeUsage(preferred, fallback):
- Prefers a usage object when it has any tokens; otherwise uses fallback.

## Provider Coverage
OpenAI
- Non-stream: usage normalized from response usage fields.
- Stream: captures usage from responses stream events when present (response.completed or usage field). If not present, providerUsage is null and estimator is used.

OpenRouter
- Non-stream: usage normalized from response.usage when present.
- Stream: captures usage from SSE events if usage appears in any chunk; last usage wins.

## Endpoint Integration
- All endpoints now pass providerUsage into UsageTracker.finalize when available.
- Streaming chat resolves provider usage via stream.providerUsagePromise.

## Logging Additions
- provider_usage_present (bool)
- provider_usage_source (openai | openrouter)
- provider_usage_fields_present (input, output, total)
- usage_input_tokens / usage_output_tokens / usage_total_tokens / usage_source

## Files Changed
- src/server/src/llm/usage/providerUsage.ts
- src/server/src/llm/usage/usageTracker.ts
- src/server/src/llm/llmClient.ts
- src/server/src/llm/providers/openrouterProvider.ts
- src/server/src/index.ts

## Remaining Gaps (Expected)
- If streaming providers do not emit usage, providerUsage will be null and estimator will be used. Tokenizer support will close this in step 2.
