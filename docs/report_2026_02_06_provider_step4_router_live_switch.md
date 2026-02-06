# Provider Step 4: Live Router Switch + Free Pool Accounting

Date: 2026-02-06
Scope: provider routing now uses policy selection; OpenAI free pool accounting is updated per request

## Summary
Provider routing now follows policy selection in real time. OpenAI requests decrement the daily free pool and per-user daily usage. OpenRouter requests do not affect the free pool. Routing and accounting are decoupled from rupiah charging.

## Key Changes
- New router: `src/server/src/llm/providerRouter.ts`
  - `pickProviderForRequest({ userId, dateKey, endpointKind })`
  - Returns provider instance and policy metadata.
- New accounting module: `src/server/src/llm/freePoolAccounting.ts`
  - `recordTokenSpend({ userId, dateKey, tokensUsed })`
  - Updates `openai_free_pool_daily` and `openai_free_user_daily_usage` transactionally.
- Endpoints now use router result to select provider and call that provider.

## Token Spend Accounting
Applies only when `actual_provider_used == openai`.

### Paper Analyze (/api/llm/paper-analyze)
- tokensUsed = inputTokens + outputTokens
- inputTokens: usage if available, else word-estimator
- outputTokens: usage if available, else word-estimator of output JSON

### Prefill (/api/llm/prefill)
- tokensUsed = inputTokens + outputTokens
- inputTokens: usage if available, else word-estimator of prompt
- outputTokens: usage if available, else word-estimator of prompt result

### Chat Stream (/api/llm/chat)
- tokensUsed = inputTokensEstimate + outputTokensEstimate
- inputTokensEstimate: word-estimator of chat input
- outputTokensEstimate: word-estimator of streamed output so far
- accounting happens in `finally`, including client abort

## Policy Meta Logging (per request)
Logged fields (no content):
- selected_provider
- actual_provider_used
- cohort_selected
- user_used_tokens_today
- pool_remaining_tokens
- user_free_cap
- reason (not_in_cohort | cap_exhausted | pool_exhausted | free_ok)

## Tables Updated
- `openai_free_pool_daily`
- `openai_free_user_daily_usage`

## Manual Test Checklist
1) Set `used_tokens = 7990` for a cohort user and make a small request:
   - routes to OpenAI
   - updates usage > 8000
2) Next request same day:
   - routes to OpenRouter (cap exhausted)
3) Set `remaining_tokens = 0`:
   - routes to OpenRouter (pool exhausted)
4) Stream abort:
   - still records token spend for OpenAI (partial output)

## Notes
- Rupiah charging is separate and unchanged.
- If OpenRouter provider is selected but not configured, errors will surface until key is provided.
