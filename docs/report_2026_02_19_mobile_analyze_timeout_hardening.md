# Report 2026-02-19: Mobile Analyze Timeout Hardening

## Scope
- Reduce mobile analysis failures caused by tight analyze timeout budgets.
- Keep timeout changes isolated to paper analysis flow.
- Avoid duplicate-charge risk from client retry behavior.

## Root Cause
1. Analyze generation used provider default timeout (`30000ms`) which is too tight for slow mobile + structured JSON output.
2. OpenRouter analyze uses two sequential text calls (first pass + repair pass), but no explicit per-pass timeout budget was set.
3. Client analyze call had no explicit timeout option at `apiPost` level.
4. Retrying timed-out paid analysis is unsafe without idempotency keys, because billing is server-side per successful run.

## Changes

### 1) Analyze-specific server timeout budget
- File: `src/server/src/routes/llmAnalyzeRoute.ts`
- Added constants:
  - `ANALYZE_TOTAL_TIMEOUT_MS = 55000`
  - `ANALYZE_OPENROUTER_RETRY_TIMEOUT_MS = 15000`
  - `ANALYZE_OPENROUTER_FIRST_PASS_TIMEOUT_MS = 40000`
- Applied `timeoutMs` to provider calls:
  - OpenAI/native structured path gets full `55000ms`.
  - OpenRouter analyze path gets split budget:
    - first pass `40000ms`
    - retry pass `15000ms`

### 2) OpenRouter analyze timeout pass-through
- File: `src/server/src/llm/analyze/openrouterAnalyze.ts`
- Extended options with:
  - `firstPassTimeoutMs?: number`
  - `retryTimeoutMs?: number`
- Forwarded those values to both `provider.generateText(...)` calls.

### 3) Analyze-only client timeout hook
- File: `src/api.ts`
- Added `ApiPostOptions`:
  - `timeoutMs?: number`
  - `signal?: AbortSignal`
- Extended `apiPost(...)` to accept optional options.
- Added timeout-aware abort wiring for POST requests.
- Timeout abort now throws `Error("api_timeout")`.
- Parent-provided abort signal remains normal abort behavior (not remapped to timeout).

### 4) Paper analyzer timeout mapping
- File: `src/ai/paperAnalyzer.ts`
- Added analyze client timeout constant:
  - `ANALYZE_API_TIMEOUT_MS = 75000`
- Analyze request now calls:
  - `apiPost("/api/llm/paper-analyze", payload, { timeoutMs: 75000 })`
- Timeout mapping:
  - client timeout (`api_timeout`) -> throws `Error("timeout")`
  - server timeout (`status===504` or `code==="timeout"`) -> throws `Error("timeout")`
- This preserves existing user-facing error mapping in `src/document/nodeBinding.ts` (`timeout` -> server unreachable guidance).

## Non-Changes (Intentional)
- No client retry was added for paper analysis.
- No billing flow changes were made.
- No idempotency key protocol was introduced in this run.

## Verification

### Automated
1. Frontend build succeeds from repo root:
   - `npm run build`
2. Backend build succeeds from `src/server`:
   - `npm run build`
3. Backend contracts succeed from `src/server`:
   - `npm run test:contracts`

### Manual checks
1. Mobile network run:
   - submit document analysis
   - verify fewer 504 failures on slow connection
2. Forced timeout path:
   - verify route returns timeout error contract (`504`, `code=timeout`)
   - verify loading gate shows timeout/server-unreachable message path
3. Regression:
   - prefill/chat/profile/payments still use existing default behavior unless explicit timeout is passed.

## Notes
- This run keeps timeout hardening bounded and low-risk.
- Safe retry for paid analyze should only be introduced with an idempotency-key contract in a separate run.
