# Run 3 Report: LLM Dedup After Route Extraction

Date: 2026-02-14
Scope: dedup pass after route extraction
Status: completed, build passing

## 1. Shared helper seams added

## 1.1 Runtime state and counters

Added:
- `src/server/src/llm/runtimeState.ts`

What moved:
- per-user concurrency slot state
- request counters (`total`, `inflight`, `streaming`)
- periodic JSON counter log tick (`60s`)

Monolith wiring:
- `src/server/src/serverMonolith.ts` now creates one runtime object and passes methods into route deps.

## 1.2 Request flow helpers

Added:
- `src/server/src/llm/requestFlow.ts`

What moved:
- `sendApiError`
- `mapLlmErrorToStatus`
- `mapTerminationReason`
- `getUsageFieldList`
- `getPriceUsdPerM`
- `logLlmRequest`

Monolith now imports these and injects them via route deps.

## 1.3 Audit state bag builder

Added:
- `src/server/src/llm/auditState.ts`

What changed in routes:
- repeated audit default initialization blocks are now built via `buildAuditState(...)` in:
  - `src/server/src/routes/llmAnalyzeRoute.ts`
  - `src/server/src/routes/llmPrefillRoute.ts`
  - `src/server/src/routes/llmChatRoute.ts`

`writeAudit` persistence shape remains unchanged (`upsertAuditRecord` with same columns).

## 1.4 Billing flow helpers

Added:
- `src/server/src/llm/billingFlow.ts`

Helpers used by all three routes:
- `estimateWithFx(...)`
- `precheckBalance(...)`
- `chargeUsage(...)`
- `applyFreepoolLedger(...)`

These replaced repeated estimate/precheck/charge/freepool code paths while preserving endpoint-specific response and logging behavior.

## 2. Route-level dedup summary

Routes remained isolated and explicit; dedup was applied only to repeated shared flow parts.

No route path changes:
- `POST /api/llm/paper-analyze`
- `POST /api/llm/prefill`
- `POST /api/llm/chat`

Chat streaming invariants preserved:
- `req.on("close")` remains
- stream finalize remains in `finally`
- no double-send behavior introduced

## 3. Static contract checklist

## 3.1 Header writes

Observed `setHeader(...)` in route modules:

- Analyze:
  - `Retry-After` on `429`
  - `X-Request-Id` on `402` insufficient branches and `200` success

- Prefill:
  - `Retry-After` on `429`
  - `X-Request-Id` on `200` success (existing behavior preserved)

- Chat:
  - `Retry-After` on `429`
  - `X-Request-Id` before stream response start
  - `Content-Type: text/plain; charset=utf-8` on stream path

No `res.append("X-Request-Id", ...)` introduced.

## 3.2 Early-exit branches and status codes

- Analyze:
  - validation error via `sendApiError` (`400` or `413`)
  - concurrency gate (`429`)
  - insufficient balance precheck (`402`)
  - structured output invalid (`502`)
  - provider error mapping (`400`, `401`, `429`, `502`, `504`)
  - post-usage charge insufficient (`402`)
  - success (`200`)

- Prefill:
  - validation error via `sendApiError` (`400` or `413`)
  - concurrency gate (`429`)
  - insufficient balance precheck (`402`)
  - provider error mapping (`400`, `401`, `429`, `502`, `504`)
  - post-usage charge insufficient (`402`)
  - success (`200`)

- Chat:
  - validation error via `sendApiError` (`400` or `413`)
  - concurrency gate (`429`)
  - insufficient balance precheck (`402`)
  - pre-stream provider error mapping (`400`, `401`, `429`, `502`, `504`)
  - stream-started upstream failure still ends stream path without JSON envelope
  - success stream path (`200` response stream semantics unchanged)

## 3.3 Audit fields written

All endpoints still write the same audit columns:
- `request_id`
- `user_id`
- `endpoint_kind`
- `selected_provider`
- `actual_provider_used`
- `logical_model`
- `provider_model_id`
- `usage_source`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `tokenizer_encoding_used`
- `tokenizer_fallback_reason`
- `provider_usage_present`
- `fx_usd_idr`
- `price_usd_per_mtoken`
- `markup_multiplier`
- `cost_idr`
- `balance_before_idr`
- `balance_after_idr`
- `charge_status`
- `charge_error_code`
- `freepool_applied`
- `freepool_decrement_tokens`
- `freepool_reason`
- `http_status`
- `termination_reason`

## 4. Build verification

Command:
```powershell
npm run build
```
Run in: `src/server`

Result:
- pass (`tsc` exit code 0).

## 5. Duplication reduction (rough)

Route file line totals:
- run 2 total: 1453 lines
- run 3 total: 1415 lines

Net route reduction: about 38 lines, with repeated flow logic centralized into shared helpers:
- runtime state
- request flow mapping/logging
- audit defaults
- billing + freepool application helpers

