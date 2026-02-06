# Report 2026-02-06: Real Token Step 3 UsageTracker Hardening

## Summary
- UsageTracker now enforces strict precedence and single-finalize behavior.
- Chat input counting uses a canonical messages serialization.
- Finalize logs safe meta-only usage fields per request.

## Precedence Rules
1) provider_usage (authoritative if total_tokens OR input+output provided)
2) tokenizer_count (if tokenizer available and stored text within size limits)
3) estimate_wordcount (fallback)

If provider usage only has total_tokens, input/output are filled from estimates.

## Chat Message Canonicalization
Location:
- src/server/src/llm/usage/tokenCounter.ts

messagesToCanonicalText(messages):
- role + content serialized into stable text lines.
- Used for tokenizer counting to prevent drift across endpoints.

UsageTracker.recordInputMessages now stores canonical text.

## Streaming Behavior
- Each chunk forwarded to client calls recordOutputChunk.
- finalize awaits providerUsagePromise if present, else tokenizes partial output.
- Client abort still produces a UsageRecord.

## Finalize Once
- UsageTracker caches the first finalized UsageRecord and returns it on subsequent calls.

## Logs (meta only)
At finalize:
- request_id, provider, logical_model
- usage_source, input_tokens, output_tokens, total_tokens
- tokenizer_encoding_used or tokenizer_fallback_reason when relevant

## Files Changed
- src/server/src/llm/usage/usageTracker.ts
- src/server/src/llm/usage/tokenCounter.ts
- src/server/src/index.ts

