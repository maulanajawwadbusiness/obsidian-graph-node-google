# Report 2026-02-06: Provider Step 7 Unified Usage Tracking

## Summary
- Added a unified usage tracker that produces one UsageRecord for all LLM endpoints.
- Pricing, rupiah deduction, and OpenAI free pool decrement now use the same UsageRecord.
- Streaming chat uses incremental output word counting; non-stream uses provider usage when available.

## Usage Record Contract
Location:
- src/server/src/llm/usage/usageTracker.ts

UsageRecord fields:
- provider: openai | openrouter
- logical_model: gpt-5.2 | gpt-5.1 | gpt-5-mini | gpt-5-nano
- provider_model_id: string
- input_tokens
- output_tokens
- total_tokens
- source: provider_usage | estimate_wordcount
- notes (optional)

Precedence:
- If provider usage exists (input/output/total), it is used.
- Otherwise, fallback to word-count estimates.

## Endpoint Integration
Paper Analyze:
- Uses UsageTracker with input text and output JSON string.
- Validates structured output before usage finalization.
- Charges rupiah using UsageRecord.
- OpenAI free pool decrement uses UsageRecord.total_tokens.

Prefill:
- Uses UsageTracker with generated input prompt and output text.
- Charges rupiah using UsageRecord.
- OpenAI free pool decrement uses UsageRecord.total_tokens.

Chat (stream):
- UsageTracker records input before streaming.
- Each chunk updates output token estimate.
- Final UsageRecord computed in finally (success, abort, or upstream error).
- Charging policy:
  - charges input + output generated so far
  - upstream error before output still charges input tokens only

## Observability
Logs now include usage fields:
- provider, provider_model_id
- usage_input_tokens, usage_output_tokens, usage_total_tokens
- usage_source
- freepool_decrement_tokens (openai only)

## Files Changed
- src/server/src/llm/usage/usageTracker.ts
- src/server/src/index.ts

## Verification Checklist
- OpenAI non-stream: usage_source=provider_usage when available.
- OpenRouter non-stream: usage_source=provider_usage if usage present, else estimate_wordcount.
- Streaming abort: output tokens reflect partial output and charge occurs.
- OpenAI free user: freepool decrement equals usage_total_tokens.

