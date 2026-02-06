# Report 2026-02-06: Provider Step 6 Structured Output Guarantees (Paper Analyze)

## Summary
- Paper analyze now enforces strict structured output validation.
- OpenAI remains the default for analyze, with optional OpenRouter enablement behind a strict allowlist.
- Any malformed structured output returns ok:false with code structured_output_invalid.

## Schema Contract
Location:
- src/server/src/llm/analyze/schema.ts

Schema (summary):
- root object with:
  - paper_title: string
  - main_points: array of objects
    - index (int)
    - title (string)
    - explanation (string)
    - length must equal nodeCount
  - links: array of objects
    - from_index (int)
    - to_index (int)
    - type (string)
    - weight (number)
    - rationale (string)

Validation:
- validateAnalyzeJson(...) enforces required fields and types.
- Any failure yields structured_output_invalid.

## Provider Strategy
Policy:
- OpenAI structured output is the default for /api/llm/paper-analyze.
- If router selects OpenRouter, analyze will force OpenAI unless explicitly enabled.

Enable OpenRouter analyze (not default):
- ALLOW_OPENROUTER_ANALYZE=true
- OPENROUTER_ANALYZE_MODELS must include the logical model (comma list).
- If allowlist is empty or missing, OpenRouter analyze is blocked.

## OpenRouter Structured Output Behavior
Location:
- src/server/src/llm/analyze/openrouterAnalyze.ts

Two-pass strategy:
1) Pass 1: prompt for JSON-only output using schema.
2) Parse + validate.
3) Pass 2 (one retry) only if invalid: re-ask with validation errors.
4) If still invalid: return structured_output_invalid.

No raw model output is returned in error responses.

## Endpoint Behavior
- /api/llm/paper-analyze always returns:
  - ok:true + valid json
  - OR ok:false with code structured_output_invalid

## Logging
Added fields for analyze logs:
- structured_output_mode: openai_native | openrouter_prompt_json | forced_openai
- validation_result: ok | retry_ok | failed

## Files Changed
- src/server/src/index.ts
- src/server/src/llm/analyze/schema.ts
- src/server/src/llm/analyze/openrouterAnalyze.ts

## Config Notes
- ALLOW_OPENROUTER_ANALYZE (bool, default false)
- OPENROUTER_ANALYZE_MODELS (comma list of logical models)

## Verification Checklist
- OpenAI analyze -> ok:true, validation ok
- Selected OpenRouter analyze with allow disabled -> forced openai
- Enabled OpenRouter + allowlisted model -> valid json or structured_output_invalid
- No ok:true returned for invalid JSON
