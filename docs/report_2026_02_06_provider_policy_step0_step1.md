# Provider Policy Step 0 + Step 1 (Scaffold)

Date: 2026-02-06
Scope: automatic provider selection policy + provider interface scaffold (no OpenRouter integration yet)

## Summary
Added a provider policy scaffold that automatically selects OpenAI or OpenRouter based on a daily free-user rotation and a daily OpenAI token pool. Implemented a provider interface contract and a pool table for daily usage tracking. Endpoints still call OpenAI; when OpenRouter would be selected, the server logs a note.

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
- `DATE_KEY_TZ = "UTC"`

## Provider Selector
File: `src/server/src/llm/providerSelector.ts`

Policy:
- Date key uses UTC `YYYY-MM-DD`.
- Free-user selection is deterministic per day using hash(userId + dateKey):
  - `score = sha256(userId:dateKey)`
  - `bucket = score % 100000`
  - free if `bucket < OPENAI_FREE_USERS_PER_DAY`
- Pool check:
  - If remaining tokens <= 0 => select OpenRouter
  - Else if free user => OpenAI
  - Else => OpenRouter

### Pool storage
Table: `openai_free_pool_daily`
Migration: `src/server/migrations/1770381000000_add_openai_free_pool_daily.js`
- `date_key` text PK
- `remaining_tokens` bigint
- `updated_at` timestamptz

Selector functions:
- `getOrInitPool(dateKey)` initializes remaining_tokens to 750000 if missing
- `checkRemaining(dateKey)` returns remaining_tokens
- `selectProvider({ userId, dateKey, endpointKind })` returns provider + reason

## Endpoint Wiring (Placeholder)
Files: `src/server/src/index.ts`

- Each /api/llm/* endpoint now calls `selectProvider(...)`.
- If OpenRouter would be selected, server logs:
  - `[llm] provider_policy would_select=openrouter ...`
- Actual requests still go to OpenAI until OpenRouter provider is implemented.

## Verification Checklist
- Same user and date => same provider (deterministic hash)
- Next day => selection can change
- Pool remaining <= 0 => OpenRouter selected
- Endpoints still function normally (OpenAI used regardless of selection)
