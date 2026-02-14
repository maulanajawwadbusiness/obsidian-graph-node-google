# Run 1 Report: LLM Duplication Map (`paper-analyze`, `prefill`, `chat`)

Date: 2026-02-14
Scope: forensic map only, no refactor
Target: `src/server/src/serverMonolith.ts`

## 1. Route spans

- `POST /api/llm/paper-analyze`: `1062-1635` (574 lines)
- `POST /api/llm/prefill`: `1747-2180` (434 lines)
- `POST /api/llm/chat`: `2181-2637` (457 lines)

Total LLM route surface in monolith: 1465 lines.

## 2. Shared 15-step flow map (anchor lines)

The same core flow is repeated in all three handlers with endpoint-specific branches.

1. Request init + counters + local state bag
- analyze: `1063-1104`
- prefill: `1748-1788`
- chat: `2182-2225`

2. Audit write guard (`writeAudit`) setup
- analyze: `1105-1141`
- prefill: `1789-1825`
- chat: `2226-2262`

3. Input validation
- analyze: starts `1143`
- prefill: starts `1827`
- chat: starts `2264`

4. Concurrency gate (`acquireLlmSlot`)
- analyze: starts `1174`
- prefill: starts `1858`
- chat: starts `2296`

5. Provider policy pick
- analyze: starts `1207`
- prefill: starts `1891`
- chat: starts `2344`

6. Model mapping + policy log
- analyze: `1221` plus provider-policy log block
- prefill: `1896` plus provider-policy log block
- chat: `2348` plus provider-policy log block

7. Usage tracker init + input recording
- analyze: starts `1233`
- prefill: starts `1930`
- chat: starts `2356`

8. FX fetch + estimate pricing
- analyze: starts near `1240-1248`
- prefill: starts near `1938-1944`
- chat: starts near `2368-2374`

9. Pre-balance insufficient check (`402`)
- analyze: branch around `1252-1294`
- prefill: branch around `1948-1989`
- chat: branch around `2377-2418`

10. Provider call execution
- analyze: structured path (`openrouter` prompt-json retry + strict schema path) and native structured path
- prefill: non-stream text path
- chat: stream path with chunk loop

11. Usage finalize
- analyze: finalize after structured result parse
- prefill: finalize after text result
- chat: finalize in `finally` after stream/provider usage promise

12. Final charge (`chargeForLlm`)
- analyze: starts `1512`
- prefill: starts `2065`
- chat: starts `2528`

13. Free pool ledger (`recordTokenSpend`)
- analyze: `openai` eligibility branch around `1560+`
- prefill: `openai` eligibility branch around `2110+`
- chat: `openai` eligibility branch around `2550+`

14. Audit finalize + request log
- analyze: success/audit/log near `1594-1629`
- prefill: success/audit/log near `2142-2174`
- chat: finalize/audit/log near `2582-2628`

15. Slot/counter release
- analyze: `releaseLlmSlot` in `finally` (`1631+`)
- prefill: `releaseLlmSlot` in `finally` (`2176+`)
- chat: `releaseLlmSlot` and streaming counter decrement in `finally` (`2582+`)

## 3. Identical vs endpoint-specific blocks

## 3.1 Mostly identical (copy-paste drift candidates)

- audit state bag variable declarations
- `writeAudit()` single-write guard wrapper
- validation error branch shape
- `acquireLlmSlot` rate-limit branch shape (`429`, `Retry-After`)
- provider policy selection + policy debug log
- pre-balance `402 insufficient_rupiah` branch shape
- usage finalize -> pricing -> charge -> `402` charge failure branch shape
- free pool `openai` ledger branch
- final `logLlmRequest` shape

## 3.2 Near-identical with light differences

- input chars/output chars fields in logs differ by endpoint payload
- provider call error mapping has different sets (analyze includes structured-output-invalid)
- header behavior differs by endpoint branch (current contract must be preserved)

## 3.3 Endpoint-specific (must stay local or have specialized helper)

- analyze only:
  - openrouter structured retry path
  - schema construction/validation path
  - forced provider fallback (`ALLOW_OPENROUTER_ANALYZE` policy)
  - `structured_output_mode` and `validation_result` in logs

- prefill only:
  - prompt synthesis from node content + recent mini chat
  - non-stream single text generation path

- chat only:
  - streaming control variables and lifecycle
  - `req.on("close")` cancel behavior
  - stream chunk loop and `res.write(...)`
  - `finally`-owned finalize after stream attempts
  - streaming counter management (`llmRequestsStreaming`)

## 4. Existing reusable helpers already present

These should be reused, not re-invented:

- validation:
  - `src/server/src/llm/validate.ts`

- provider policy + provider mapping:
  - `src/server/src/llm/providerRouter.ts`
  - `src/server/src/llm/models/modelMap.ts`
  - `src/server/src/llm/getProvider.ts`

- analyze-specific helpers:
  - `src/server/src/llm/analyze/prompt.ts`
  - `src/server/src/llm/analyze/schema.ts`
  - `src/server/src/llm/analyze/openrouterAnalyze.ts`

- usage tracking:
  - `src/server/src/llm/usage/usageTracker.ts`
  - `src/server/src/llm/usage/providerUsage.ts`

- audit persistence:
  - `src/server/src/llm/audit/llmAudit.ts`

- pricing + FX + billing:
  - `src/server/src/pricing/pricingCalculator.ts`
  - `src/server/src/pricing/pricingConfig.ts`
  - `src/server/src/fx/fxService.ts`
  - `src/server/src/rupiah/rupiahService.ts`

- free-pool accounting:
  - `src/server/src/llm/freePoolAccounting.ts`

## 5. Extraction implications for run 2

- Route extraction can be done with parity by moving each full handler body into `src/server/src/routes/*` and passing monolith-owned helpers/state through deps.
- No dedup is needed in run 2.
- Chat streaming lifecycle must remain untouched during move.

## 6. Dedup implications for run 3

Best seams for dedup after extraction:

- runtime state/counters/concurrency helpers
- audit state bag and write-once helper
- billing flow helper (estimate + precheck + charge + freepool)
- request log and termination mapping helper

Do not create one mega helper for all three routes. Chat streaming needs a dedicated variant.

