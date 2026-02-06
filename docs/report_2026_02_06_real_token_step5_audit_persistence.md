# Report 2026-02-06: Real Token Step 5 Audit Persistence

## Summary
- Added llm_request_audit table for durable per-request audit trails.
- Upserted audit records keyed by request_id (idempotent).
- Each endpoint writes audit data after usage finalize, charging, and freepool accounting.

## Migration
File:
- src/server/migrations/1770382500000_add_llm_request_audit.js

Table: llm_request_audit
- request_id TEXT PK
- created_at timestamptz
- user_id BIGINT
- endpoint_kind TEXT
- selected_provider TEXT
- actual_provider_used TEXT
- logical_model TEXT
- provider_model_id TEXT
- usage_source TEXT
- input_tokens BIGINT
- output_tokens BIGINT
- total_tokens BIGINT
- tokenizer_encoding_used TEXT
- tokenizer_fallback_reason TEXT
- provider_usage_present BOOLEAN
- fx_usd_idr NUMERIC
- price_usd_per_mtoken NUMERIC
- markup_multiplier NUMERIC
- cost_idr BIGINT
- balance_before_idr BIGINT
- balance_after_idr BIGINT
- charge_status TEXT
- charge_error_code TEXT
- freepool_applied BOOLEAN
- freepool_decrement_tokens BIGINT
- freepool_reason TEXT
- http_status INT
- termination_reason TEXT

Indexes:
- (user_id, created_at desc)
- (created_at desc)
- (endpoint_kind, created_at desc)

## Audit Writer
File:
- src/server/src/llm/audit/llmAudit.ts

Behavior:
- upsertAuditRecord(...) writes or updates by request_id (idempotent).

## Endpoint Integration
- /api/llm/paper-analyze, /api/llm/prefill, /api/llm/chat
- Records written after UsageTracker.finalize, charging, and freepool decisions.
- Streaming aborts and upstream errors still write an audit record.

## Example Debug Queries
Last 50 requests for a user:
- select * from llm_request_audit where user_id = $1 order by created_at desc limit 50;

Requests where usage_source != provider_usage:
- select * from llm_request_audit where usage_source <> 'provider_usage' order by created_at desc limit 100;

Requests where freepool applied:
- select * from llm_request_audit where freepool_applied = true order by created_at desc limit 100;

Requests with failed charges:
- select * from llm_request_audit where charge_status = 'failed' order by created_at desc limit 100;

## Files Changed
- src/server/migrations/1770382500000_add_llm_request_audit.js
- src/server/src/llm/audit/llmAudit.ts
- src/server/src/index.ts

