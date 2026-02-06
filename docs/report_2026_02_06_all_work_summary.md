# Report 2026-02-06: Full Work Summary

## Scope Summary
This report summarizes the work completed in this session, focused on:
- LLM provider routing, usage accounting, and token accuracy
- Rupiah pricing and charging
- OpenRouter integration and OpenAI usage capture
- Structured output guarantees for paper analyze
- Free pool policy alignment and idempotency
- Audit persistence for LLM request metadata
- Contract tests and documentation updates

## Key Deliverables

### Provider System and Routing
- LLM Provider interface and policy routing with:
  - daily cohort (60 users)
  - per-user cap (8000 tokens/day)
  - global pool (750000 tokens/day)
- Providers:
  - OpenAI (Responses API)
  - OpenRouter (SSE parsing to raw chunks)
- Logical model mapping layer to keep provider ids consistent.

Key files:
- src/server/src/llm/providers/types.ts
- src/server/src/llm/providers/openaiProvider.ts
- src/server/src/llm/providers/openrouterProvider.ts
- src/server/src/llm/providerSelector.ts
- src/server/src/llm/providerRouter.ts
- src/server/src/llm/getProvider.ts
- src/server/src/llm/models/logicalModels.ts
- src/server/src/llm/models/modelMap.ts

### Structured Output Guarantees (paper analyze)
- Strict schema validation in one place.
- OpenRouter analyze gated by allowlist; default forces OpenAI.
- Two-pass JSON prompt for OpenRouter when enabled.

Key files:
- src/server/src/llm/analyze/schema.ts
- src/server/src/llm/analyze/openrouterAnalyze.ts
- src/server/src/index.ts

### Rupiah Pricing and Charging
- Rupiah balance and ledger tables.
- Pricing config, calculator, and token estimator.
- Charging integrated with LLM endpoints.
- FX service with provider fetch + DB fallback.

Key files:
- src/server/src/pricing/pricingConfig.ts
- src/server/src/pricing/pricingCalculator.ts
- src/server/src/pricing/tokenEstimate.ts
- src/server/src/fx/fxService.ts
- src/server/src/rupiah/rupiahService.ts
- src/server/src/index.ts

### Real Token Counting
- Provider usage normalization.
- Tokenizer fallback with @dqbd/tiktoken.
- Hardened UsageTracker with precedence rules and finalize-once.

Key files:
- src/server/src/llm/usage/providerUsage.ts
- src/server/src/llm/usage/tokenCounter.ts
- src/server/src/llm/usage/usageTracker.ts
- src/server/src/llm/llmClient.ts

### Free Pool Alignment (idempotent)
- Ledger table prevents double decrement per request_id.
- Free pool and per-user usage use UsageRecord.total_tokens only.

Key files:
- src/server/src/llm/freePoolAccounting.ts
- src/server/migrations/1770382000000_add_openai_free_pool_ledger.js

### Audit Persistence
- New audit table for per-request LLM metadata.
- Upsert keyed by request_id.

Key files:
- src/server/src/llm/audit/llmAudit.ts
- src/server/migrations/1770382500000_add_llm_request_audit.js
- src/server/src/index.ts

### Contract Tests
- Added minimal contract test script for LLM endpoints.

Key files:
- src/server/scripts/test-llm-contracts.mjs
- src/server/package.json

## Migrations Added
- 1770379000000_add_rupiah_tables.js
- 1770380000000_add_fx_rates.js
- 1770381000000_add_openai_free_pool_daily.js
- 1770381500000_add_openai_free_user_daily_usage.js
- 1770382000000_add_openai_free_pool_ledger.js
- 1770382500000_add_llm_request_audit.js

## Reports Written (selection)
- docs/report_2026_02_06_provider_policy_step0_step1.md
- docs/report_2026_02_06_provider_step2_openai_provider_adapter.md
- docs/report_2026_02_06_provider_step3_openrouter_provider.md
- docs/report_2026_02_06_provider_step4_router_live_switch.md
- docs/report_2026_02_06_provider_step5_model_mapping.md
- docs/report_2026_02_06_provider_step6_structured_output_analyze.md
- docs/report_2026_02_06_provider_step7_unified_usage_pricing_rupiah.md
- docs/report_2026_02_06_provider_step8_endpoint_contracts_lock.md
- docs/report_2026_02_06_real_token_step1_provider_usage.md
- docs/report_2026_02_06_real_token_step2_tokenizer_fallback.md
- docs/report_2026_02_06_real_token_step3_usageTracker_hardening.md
- docs/report_2026_02_06_real_token_step4_freepool_alignment.md
- docs/report_2026_02_06_real_token_step5_audit_persistence.md

## Tests Run
- test:llm-contracts was attempted once and failed because the server was not running.

## Notes and Guardrails
- No secrets were written to repo files.
- LLM responses and prompts are never logged; only meta data is logged and persisted.
- Endpoint response contracts were preserved.

