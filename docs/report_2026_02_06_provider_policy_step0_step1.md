# Provider Policy Step 0 + Step 1 (Scaffold)

Date: 2026-02-06
Scope: automatic provider selection policy + provider interface scaffold (no OpenRouter integration yet)

## Summary
Added a provider policy scaffold that automatically selects OpenAI or OpenRouter based on a daily free-user rotation, a daily OpenAI token pool, and a per-user daily cap. Implemented a provider interface contract, a pool table, and a per-user usage table. Endpoints still call OpenAI; the provider choice is logged for now.

## Provider Interface
File: `src/server/src/llm/providers/types.ts`

Interface:
- `name: "openai" | "openrouter"`
- `generateText(...)`
- `generateTextStream(...)` returning raw text chunks
- `generateStructuredJson(...)`

This is a contract only; OpenRouter implementation is deferred to the next step.

## Provider Policy Config
File: `src/server/src/llm/providerPolicyConfig.ts`

Constants:
- `OPENAI_DAILY_FREE_POOL_TOKENS = 750000`
- `OPENAI_FREE_USERS_PER_DAY = 60`
- `OPENAI_FREE_TOKENS_PER_USER_PER_DAY = 8000`
- `DATE_KEY_TZ = "UTC"`

## Provider Selector
File: `src/server/src/llm/providerSelector.ts`

Policy:
- Date key uses UTC `YYYY-MM-DD`.
- Free-user selection is deterministic per day using hash(userId + dateKey):
  - `score = sha256(userId:dateKey)`
  - `bucket = score % 100000`
  - free if `bucket < OPENAI_FREE_USERS_PER_DAY`
- Pool and cap checks:
  - If remaining tokens <= 0 => OpenRouter (failsafe)
  - If user not in cohort => OpenRouter
  - If user in cohort and used_tokens >= 8000 => OpenRouter
  - If user in cohort and used_tokens < 8000 and pool remaining > 0 => OpenAI

Safeguard math:
- Planned spend: `60 * 8000 = 480000` tokens/day
- Safety buffer: `750000 - 480000 = 270000` tokens/day

### Pool storage
Table: `openai_free_pool_daily`
Migration: `src/server/migrations/1770381000000_add_openai_free_pool_daily.js`
- `date_key` text PK
- `remaining_tokens` bigint
- `updated_at` timestamptz

### Per-user daily usage storage
Table: `openai_free_user_daily_usage`
Migration: `src/server/migrations/1770381500000_add_openai_free_user_daily_usage.js`
- `date_key` text
- `user_id` bigint (users.id)
- `used_tokens` bigint
- `updated_at` timestamptz
- Primary key (`date_key`, `user_id`)

Selector functions:
- `getOrInitPool(dateKey)` initializes remaining_tokens to 750000 if missing
- `checkRemaining(dateKey)` returns remaining_tokens
- `getOrInitUserUsage(dateKey, userId)` returns used_tokens
- `selectProvider({ userId, dateKey, endpointKind })` returns provider + reason + usage info

## Endpoint Wiring (Placeholder)
Files: `src/server/src/index.ts`

- Each /api/llm/* endpoint now calls `selectProvider(...)`.
- Server logs selection details:
  - `selected_provider`, `cohort`, `user_used_tokens`, `pool_remaining_tokens`, `cap`.
- Actual requests still go to OpenAI until OpenRouter provider is implemented.

## Verification Checklist
- Same user and date => same provider (deterministic hash)
- Next day => selection can change
- Pool remaining <= 0 => OpenRouter selected
- Endpoints still function normally (OpenAI used regardless of selection)
