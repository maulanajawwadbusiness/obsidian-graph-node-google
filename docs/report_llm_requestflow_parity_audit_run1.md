# Run 1 Report: RequestFlow Parity Audit and Header Ordering Risk

Date: 2026-02-14
Scope: forensic parity audit for centralized request-flow helpers
Status: completed (no code changes)

## 1. Objective

Validate whether centralizing these helpers changed behavior:
- `mapLlmErrorToStatus`
- `mapTerminationReason`
- `sendApiError`

And verify whether any callsite ordering now risks header contract violations.

## 2. Source Baseline

Compared:
- pre-dedup helper definitions embedded in `src/server/src/serverMonolith.ts` at commit `5f2f40f`
- current centralized helper definitions in `src/server/src/llm/requestFlow.ts`

Result:
- helper logic for status mapping and termination mapping is behavior-equivalent to run2 baseline.
- no semantic changes were introduced by run3 helper centralization itself.

## 3. Mapping Matrix (Parity)

## 3.1 `mapLlmErrorToStatus`

| LlmError.code | HTTP status |
| --- | --- |
| `bad_request` | `400` |
| `rate_limited` | `429` |
| `timeout` | `504` |
| `parse_error` | `502` |
| `unauthorized` | `401` |
| other/default | `502` |

## 3.2 `mapTerminationReason(statusCode, code)`

| Condition | termination_reason |
| --- | --- |
| `statusCode===402` OR `code==="insufficient_rupiah"` | `insufficient_rupiah` |
| `statusCode===429` | `rate_limited` |
| `statusCode===400` OR `statusCode===413` | `validation_error` |
| `statusCode===504` OR `code==="timeout"` | `timeout` |
| `code==="structured_output_invalid"` | `structured_output_invalid` |
| `code==="upstream_error"` OR `statusCode>=500` | `upstream_error` |
| `statusCode===200` | `success` |
| fallback | `upstream_error` |

## 3.3 `sendApiError`

Current behavior:
1. set `X-Request-Id`
2. send JSON body with `res.status(status).json(body)`

This means any extra header set after `sendApiError(...)` is late/unsafe.

## 4. Contract Risk Found (Actual Issue)

Risk is not mapping drift. Risk is header ordering at `429` callsites.

Pattern in all three routes:
1. call `sendApiError(...)` (sends body)
2. then call `res.setHeader("Retry-After", "5")`

This can cause:
- missing `Retry-After` on actual response
- header mutation attempt after body send
- potential `ERR_HTTP_HEADERS_SENT`

## 4.1 Affected Call Sites

- `src/server/src/routes/llmAnalyzeRoute.ts:147` then `src/server/src/routes/llmAnalyzeRoute.ts:153`
- `src/server/src/routes/llmPrefillRoute.ts:141` then `src/server/src/routes/llmPrefillRoute.ts:147`
- `src/server/src/routes/llmChatRoute.ts:146` then `src/server/src/routes/llmChatRoute.ts:152`

## 5. Recommended Fix Direction (for run2)

- extend `sendApiError` to accept optional headers (for example `Retry-After`)
- set all headers before `res.status(...).json(...)`
- migrate the three `429` branches to pass `Retry-After` through `sendApiError`
- remove post-send `setHeader` calls

This preserves status/body contracts while removing header-order hazards.
