# Provider Step 5: Logical Model Mapping Layer

Date: 2026-02-06
Scope: logical model enums + provider-specific mapping + log clarity

## Summary
Added a logical model layer owned by the server and a mapping function to translate logical models to provider-specific model IDs. Providers now receive logical models and map internally. Logs include both logical model and provider model id.

## Logical Models
File: `src/server/src/llm/models/logicalModels.ts`

Logical model set:
- `gpt-5.2`
- `gpt-5.1`
- `gpt-5-mini`
- `gpt-5-nano`

Endpoint defaults:
- chat: `gpt-5.1`
- analyze: `gpt-5.2`
- prefill: `gpt-5-nano`

## Model Mapping
File: `src/server/src/llm/models/modelMap.ts`

Mapping table:
- OpenAI provider: uses logical IDs as-is
- OpenRouter provider defaults:
  - `gpt-5.2` -> `openai/gpt-5.2`
  - `gpt-5.1` -> `openai/gpt-5.1`
  - `gpt-5-mini` -> `openai/gpt-5-mini`
  - `gpt-5-nano` -> `openai/gpt-5-nano`

Overrides:
- env var `OPENROUTER_MODEL_GPT_5_2`, `OPENROUTER_MODEL_GPT_5_1`, `OPENROUTER_MODEL_GPT_5_MINI`, `OPENROUTER_MODEL_GPT_5_NANO`

## Provider Integration
- `src/server/src/llm/providers/openaiProvider.ts` maps logical -> provider id internally.
- `src/server/src/llm/providers/openrouterProvider.ts` maps logical -> provider id internally.
- `src/server/src/llm/validate.ts` now validates models against logical defaults.

## Logging
- LLM logs now include:
  - `model` (logical)
  - `provider_model_id` (provider-specific id)

## Notes
- Endpoint response shapes unchanged.
- Pricing keys remain logical model names.

## Verification (manual)
- Run one request per endpoint on OpenAI and OpenRouter.
- Confirm logs show both logical model and provider model id.
- Confirm output shapes unchanged.
