# Report 2026-02-06: Real Token Step 4 Free Pool Alignment

## Summary
- OpenAI free pool and per-user cap now decrement using UsageRecord.total_tokens only.
- Added idempotent ledger to prevent double-decrement per request_id.
- Free pool decrement is applied only for eligible free-cohort OpenAI requests.

## Single Source Of Truth
- UsageRecord.total_tokens produced by UsageTracker.finalize is used for:
  - rupiah pricing and deduction
  - openai free pool decrement
- No other estimators are used for pool or cap.

## Idempotent Ledger
Migration:
- src/server/migrations/1770382000000_add_openai_free_pool_ledger.js

Schema:
- openai_free_pool_ledger
  - request_id TEXT PRIMARY KEY
  - date_key TEXT NOT NULL
  - user_id BIGINT NOT NULL
  - tokens BIGINT NOT NULL
  - created_at timestamptz NOT NULL default now()

Behavior:
- recordTokenSpend inserts ledger row first.
- If request_id already exists, it returns applied=false and does not decrement pool or user usage.

## Decrement Rules
- Decrement only when:
  - actual_provider_used == openai
  - policy cohort_selected == true
  - policy reason == free_ok
- Forced OpenAI for analyze does NOT decrement unless free-cohort eligible.

## Logging (meta only)
- freepool_decrement_tokens
- freepool_decrement_applied
- freepool_decrement_reason (applied | already_ledgered | not_in_cohort | cap_exhausted | provider_not_openai | error)

## Files Changed
- src/server/migrations/1770382000000_add_openai_free_pool_ledger.js
- src/server/src/llm/freePoolAccounting.ts
- src/server/src/index.ts

