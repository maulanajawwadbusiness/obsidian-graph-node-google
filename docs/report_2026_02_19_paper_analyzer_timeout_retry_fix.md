# Report 2026-02-19: Paper Analyzer Timeout And Retry Fix

## Scope
- Correct analyzer client timeout constant to 120 seconds.
- Add one timeout-only retry in `paperAnalyzer`.

## Problems Fixed
1. `ANALYZE_API_TIMEOUT_MS` was set to `75_000` instead of `120_000`.
2. Timeout path failed immediately without the requested single retry.

## Changes
- File: `src/ai/paperAnalyzer.ts`
  - Updated timeout constant:
    - `ANALYZE_API_TIMEOUT_MS = 120_000`
  - Added retry limit:
    - `ANALYZE_TIMEOUT_RETRY_COUNT = 1`
  - Wrapped analyze API call in an attempt loop:
    - max 2 attempts total (first attempt + one retry)
    - retry only when error class is timeout
  - Timeout classification:
    - client timeout: `api_timeout` mapped to `timeout`
    - server timeout: `status === 504` or `code === "timeout"` mapped to `timeout`
  - Non-timeout errors keep fail-fast behavior.

## Behavioral Contract After Fix
- Analyzer request timeout budget is now 120 seconds per attempt.
- On timeout:
  - first timeout triggers one retry
  - second timeout fails with `Error("timeout")`
- Auth, balance, and semantic validation behavior remain unchanged.

## Verification
- `npm run build` (repo root): passed.

## Notes
- This change intentionally does not add idempotency-key protections.
- Retry scope is limited to timeout cases only.
