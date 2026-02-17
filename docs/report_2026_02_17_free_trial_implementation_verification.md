# Free Trial Implementation Verification Report (2026-02-17)

## A) Verdict
PARTIAL

Rationale: The routing, accounting, idempotency, daily date_key isolation, and observability are implemented end-to-end, but the "daily rotating free cohort: up to 60 users/day" requirement does not match current cohort selection logic. The current logic is probabilistic by user hash bucket (`score % 100000 < 60`) and does not enforce a hard cap of 60 users per day.

## Scope and Method
- Traced flow from endpoint -> provider router -> usage finalize -> freepool accounting -> audit/log writes.
- Verified code and migrations under `src/server/src/llm/*`, `src/server/src/routes/*`, and `src/server/migrations/*`.
- No secrets copied.
- Verification is code-plus-migration based. No runtime DB introspection output is included in this report.

## B) Proof (Code Paths, Functions, Logic)

### 1) Provider selection/router

#### Router module and policy constants
- `src/server/src/llm/providerPolicyConfig.ts:1`
  - `OPENAI_DAILY_FREE_POOL_TOKENS = 750_000`
- `src/server/src/llm/providerPolicyConfig.ts:2`
  - `OPENAI_FREE_USERS_PER_DAY = 60`
- `src/server/src/llm/providerPolicyConfig.ts:3`
  - `OPENAI_FREE_TOKENS_PER_USER_PER_DAY = 8_000`
- `src/server/src/llm/providerPolicyConfig.ts:4`
  - `DATE_KEY_TZ = "UTC"`

#### Today cohort, per-user cap, pool checks
- `src/server/src/llm/providerSelector.ts:15`
  - `getDateKeyUtc()` builds `YYYY-MM-DD` from UTC date.
- `src/server/src/llm/providerSelector.ts:22`
  - `getTodayDateKey()` returns UTC key.
- `src/server/src/llm/providerSelector.ts:33`
  - `isSelectedFreeUser(userId, dateKey)` performs deterministic hash-based selection.
- `src/server/src/llm/providerSelector.ts:35`
  - `bucket = score % 100000`
- `src/server/src/llm/providerSelector.ts:36`
  - free selection condition: `bucket < OPENAI_FREE_USERS_PER_DAY`
- `src/server/src/llm/providerSelector.ts:88`
  - if `remaining <= 0` -> provider `openrouter` (`pool_exhausted`)
- `src/server/src/llm/providerSelector.ts:102`
  - if `usedTokens >= cap` -> provider `openrouter` (`cap_exceeded`)
- `src/server/src/llm/providerSelector.ts:115`
  - if free user and under cap -> provider `openai` (`free_user`)
- `src/server/src/llm/providerSelector.ts:126`
  - non-selected users -> provider `openrouter` (`not_selected`)

#### Policy meta mapping for auditing/routing decisions
- `src/server/src/llm/providerRouter.ts:13`
  - `pickProviderForRequest()` wraps selector output.
- `src/server/src/llm/providerRouter.ts:23`
  - default reason `free_ok`, mapped to `not_in_cohort`, `cap_exhausted`, `pool_exhausted`.

#### Endpoint coverage
- Chat:
  - `src/server/src/routes/llmChatRoute.ts:190`
  - calls `pickProviderForRequest({ userId, endpointKind: "chat" })`
- Prefill:
  - `src/server/src/routes/llmPrefillRoute.ts:170`
  - calls `pickProviderForRequest({ userId, endpointKind: "prefill" })`
- Paper analyze:
  - `src/server/src/routes/llmAnalyzeRoute.ts:176`
  - calls `pickProviderForRequest({ userId, endpointKind: "analyze" })`

#### Analyze forced-openai behavior
- `src/server/src/routes/llmAnalyzeRoute.ts:180`
  - if selected provider is openrouter and model not allowed for openrouter analyze, provider is forced to openai.
- `src/server/src/routes/llmAnalyzeRoute.ts:194`
  - logs `forced_provider=openai reason=analyze_requires_strict_json`.
- Free-trial accounting still uses policy eligibility (`router.policyMeta`) when applying freepool ledger, so forced-openai requests that are not free-eligible are treated as paid-openai usage.

### 2) Accounting and idempotency

#### Freepool decrement and per-user usage in transaction
- `src/server/src/llm/freePoolAccounting.ts:3`
  - `recordTokenSpend({ requestId, userId, dateKey, tokensUsed })`
- `src/server/src/llm/freePoolAccounting.ts:13`
  - transaction begins (`BEGIN`)
- `src/server/src/llm/freePoolAccounting.ts:16`
  - ledger insert into `openai_free_pool_ledger`
- `src/server/src/llm/freePoolAccounting.ts:18`
  - idempotency guard: `on conflict (request_id) do nothing`
- `src/server/src/llm/freePoolAccounting.ts:21`
  - if duplicate request_id, returns `applied: false` (no second decrement)
- `src/server/src/llm/freePoolAccounting.ts:44`
  - updates pool with clamp: `remaining_tokens = greatest(remaining_tokens - $2, 0)`
- `src/server/src/llm/freePoolAccounting.ts:52`
  - increments per-user usage: `used_tokens = used_tokens + $3`
- `src/server/src/llm/freePoolAccounting.ts:60`
  - commits both updates together (`COMMIT`)

#### Same token source used for decrement and cap accounting
- `src/server/src/routes/llmChatRoute.ts:353`
  - `usageRecord = await usageTracker.finalize({ providerUsage })`
- `src/server/src/routes/llmChatRoute.ts:398`
  - `tokensUsed: usageRecord.total_tokens` passed to freepool ledger
- `src/server/src/routes/llmPrefillRoute.ts:321`
  - finalize usage
- `src/server/src/routes/llmPrefillRoute.ts:392`
  - uses `usageRecord.total_tokens` for freepool decrement
- `src/server/src/routes/llmAnalyzeRoute.ts:458`
  - finalize usage
- `src/server/src/routes/llmAnalyzeRoute.ts:530`
  - uses `usageRecord.total_tokens` for freepool decrement

#### UsageRecord token source precedence
- `src/server/src/llm/usage/usageTracker.ts:154`
  - provider usage normalized first
- `src/server/src/llm/usage/usageTracker.ts:170`
  - source `provider_usage`
- `src/server/src/llm/usage/usageTracker.ts:217`
  - fallback source `tokenizer_count`
- `src/server/src/llm/usage/usageTracker.ts:247`
  - final fallback `estimate_wordcount`
- `src/server/src/llm/usage/providerUsage.ts:15`
  - normalizes provider fields including `total_tokens`

### 3) Daily reset mechanism
- `src/server/src/llm/providerSelector.ts:84`
  - selector always computes/uses today `date_key`
- `src/server/src/llm/providerSelector.ts:42`
  - pool row is per `date_key` (insert on first touch)
- `src/server/src/llm/providerSelector.ts:69`
  - user usage row is per `(date_key, user_id)` (insert on first touch)
- `src/server/src/llm/freePoolAccounting.ts:16`
  - ledger entries include `date_key`

Conclusion: reset is implicit via date partitioning (`date_key`) and lazy initialization; no cron is required by current implementation.

### 4) Routing registration coverage
- `src/server/src/server/bootstrap.ts:141`
  - registers analyze route
- `src/server/src/server/bootstrap.ts:145`
  - registers prefill route
- `src/server/src/server/bootstrap.ts:146`
  - registers chat route

## C) DB Tables and Migrations Involved

### Free cohort table
- No dedicated persisted cohort table exists.
- Cohort membership is algorithmic at runtime via hash in `providerSelector.ts`.

### Per-user daily usage (cap tracking)
- Migration: `src/server/migrations/1770381500000_add_openai_free_user_daily_usage.js`
- Table: `openai_free_user_daily_usage`
- Key columns:
  - `date_key` (text)
  - `user_id` (bigint)
  - `used_tokens` (bigint)
- PK: `(date_key, user_id)`

### Daily OpenAI free pool
- Migration: `src/server/migrations/1770381000000_add_openai_free_pool_daily.js`
- Table: `openai_free_pool_daily`
- Key columns:
  - `date_key` (text, PK)
  - `remaining_tokens` (bigint)

### Ledger/idempotency
- Migration: `src/server/migrations/1770382000000_add_openai_free_pool_ledger.js`
- Table: `openai_free_pool_ledger`
- Key columns:
  - `request_id` (text, PK)
  - `date_key` (text)
  - `user_id` (bigint)
  - `tokens` (bigint)

### Request audit
- Migration: `src/server/migrations/1770382500000_add_llm_request_audit.js`
- Table: `llm_request_audit`
- Fields relevant to proof:
  - `selected_provider`
  - `actual_provider_used`
  - `usage_source`
  - `total_tokens`
  - `freepool_applied`
  - `freepool_decrement_tokens`
  - `freepool_reason`

## D) Observability Proof

### Provider decision logs
- Chat/prefill/analyze routes each emit provider policy log including:
  - selected provider
  - actual provider
  - cohort flag
  - used tokens
  - pool remaining
  - cap
  - reason
  - date_key
- References:
  - `src/server/src/routes/llmChatRoute.ts:198`
  - `src/server/src/routes/llmPrefillRoute.ts:177`
  - `src/server/src/routes/llmAnalyzeRoute.ts:192`

### Usage source and tokens logs
- `usageTracker` emits `usage_finalize` with `usage_source`, token fields, `total_tokens`.
- Reference:
  - `src/server/src/llm/usage/usageTracker.ts` (finalize logging blocks)

### Request-level log payload
- Request flow log includes:
  - `usage_total_tokens`
  - `usage_source`
  - freepool decrement fields
- Reference:
  - `src/server/src/llm/requestFlow.ts`

### Persistent audit proof
- Upserted per request into `llm_request_audit` with selected vs actual provider, total tokens, usage source, freepool fields.
- Reference:
  - `src/server/src/llm/audit/llmAudit.ts`

## E) Edge Cases Checked

### Streaming abort
- `src/server/src/routes/llmChatRoute.ts:299`
  - sets termination reason `client_abort`.
- `src/server/src/routes/llmChatRoute.ts:353`
  - still finalizes usage in `finally`.
- `src/server/src/routes/llmChatRoute.ts:393`
  - still executes freepool ledger application path in `finally`.

### Retry / duplicate request_id
- `src/server/src/llm/freePoolAccounting.ts:18`
  - `on conflict (request_id) do nothing` prevents double decrement.
- `src/server/src/llm/freePoolAccounting.ts:21`
  - duplicate recognized and returns non-applied result.

### User reaches 8,000 cap mid-day
- `src/server/src/llm/providerSelector.ts:102`
  - when `usedTokens >= cap`, provider is openrouter (`cap_exceeded`).

### Pool exhausted
- `src/server/src/llm/providerSelector.ts:88`
  - when `remaining <= 0`, provider is openrouter (`pool_exhausted`).

## Requirement-by-Requirement Status

1. Daily rotating free cohort up to 60 users/day: PARTIAL
- Constants include 60/day, but implementation is hash-threshold probability, not hard capped cohort cardinality.

2. Per free user cap 8,000 real tokens/day: IMPLEMENTED
- Cap constant 8,000 and enforcement on daily usage table.
- Counter increment uses `usageRecord.total_tokens`.

3. Daily pool 750,000 with buffer behavior: IMPLEMENTED
- Pool constant 750,000.
- Decrement clamped to zero in DB update.

4. Routing rule openai else openrouter: PARTIAL
- Implemented for normal policy flow.
- Analyze route can force openai for schema reliability when openrouter analyze disallowed; this is an explicit exception path.

5. Real tokens source of truth: IMPLEMENTED
- `UsageRecord.total_tokens` from finalize precedence (`provider_usage > tokenizer_count > estimate_wordcount`) is used for freepool decrement path.

6. Idempotent decrement by request_id: IMPLEMENTED
- Ledger PK and conflict no-op guard.

7. Per-user increment and pool decrement safety: IMPLEMENTED
- Same transaction in `recordTokenSpend`.

8. Observability fields for proof: IMPLEMENTED
- Provider selection, actual provider, freepool fields, total tokens, usage source are present in logs/audit.

## Missing Pieces and Exact Recommended Patch List (Not Implemented Here)

1. Enforce true "up to 60 users/day" cohort cardinality.
- Problem: `bucket < 60` on modulo 100000 does not cap to 60 users/day.
- Patch:
  - Add table `openai_free_user_daily_cohort(date_key text, user_id bigint, selected_at timestamptz, primary key(date_key,user_id))`.
  - Add index on `(date_key, selected_at)`.
  - In provider selection transaction:
    - If user already in cohort for date_key, keep selected.
    - Else count cohort rows for date_key with `FOR UPDATE` locking strategy.
    - Insert user only if count < 60.
  - Replace hash-threshold as the selection gate with persisted capped cohort membership.

2. Optional hard precheck against pool before selecting openai.
- Current behavior relies on post-decrement clamp and `remaining > 0` check.
- Patch (optional): compare `remaining_tokens` against a conservative requested estimate before selecting openai, then still clamp on finalize.

3. Improve analyze forced-openai observability semantics.
- Current audit stores selected provider from policy and actual provider used.
- Patch (optional): add explicit field `provider_override_reason` to `llm_request_audit` to make forced-openai decisions queryable without parsing logs.

## Secrets and Agent Safety Check
- `AGENTS.md` includes explicit no-secret policy (`SECRETS POLICY`).
- `CLAUDE.md` includes explicit hard rules to never paste/write secrets.

