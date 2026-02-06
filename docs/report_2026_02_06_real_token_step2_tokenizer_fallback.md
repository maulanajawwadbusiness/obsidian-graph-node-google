# Report 2026-02-06: Real Token Step 2 Tokenizer Fallback

## Summary
- Added server-side tokenizer fallback using @dqbd/tiktoken.
- UsageTracker now prefers provider usage, then tokenizer count, then word-count estimate.
- Tokenizer is server-only with dynamic import and cached encoding.

## Dependency
- @dqbd/tiktoken (server-only)
- Dynamic import with cached encoding instance.

## Token Counter
Location:
- src/server/src/llm/usage/tokenCounter.ts

Behavior:
- Maps logical models to encoding name:
  - gpt-5.2, gpt-5.1, gpt-5-mini, gpt-5-nano -> cl100k_base
- Uses encoding_for_model if available, otherwise get_encoding("cl100k_base").
- Counts tokens on text or message-serialized text.

## UsageTracker Precedence
1) provider_usage
2) tokenizer_count
3) estimate_wordcount

Tokenizer usage:
- Stores input/output text up to 2,000,000 chars each.
- If exceeded, falls back to estimate_wordcount with reason text_too_large.
- If tokenizer fails to load or encode, falls back to estimate_wordcount with reason tokenizer_unavailable.

## Logging Additions
- usage_source now includes tokenizer_count
- tokenizer_encoding_used
- tokenizer_fallback_reason

## Files Changed
- src/server/src/llm/usage/tokenCounter.ts
- src/server/src/llm/usage/usageTracker.ts
- src/server/src/index.ts
- src/server/src/llm/llmClient.ts (usage types)
- src/server/src/llm/providers/openrouterProvider.ts (usage normalization)
- package.json + package-lock.json (dependency)

## Notes
- No endpoint response shape changes.
- Tokenizer is used only when provider usage is missing.
