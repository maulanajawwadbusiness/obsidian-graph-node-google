# Money System v1: Credits Balance + Ledger + LLM Deduction

Date: 2026-02-06
Scope: credits tables, credits service, deduction on LLM endpoints, topup crediting from Midtrans

## Summary
Implemented a minimal credits system with a balance table and an append-only ledger. LLM endpoints now deduct fixed credits per request, and Midtrans paid transactions now credit balances idempotently. All balance mutations are transactional with row-level locks.

## Schema (node-pg-migrate)
Migration: `src/server/migrations/1770378000000_add_credits_tables.js`

Tables:
- `credits_balances`
  - `user_id` bigint PK, FK -> `users(id)`
  - `balance` bigint not null default 0
  - `updated_at` timestamptz default now()

- `credits_ledger`
  - `id` uuid PK (app-generated)
  - `user_id` bigint FK -> `users(id)`
  - `delta` bigint (positive for topup, negative for usage)
  - `reason` text (topup|usage|adjustment)
  - `ref_type` text (midtrans_order|llm_request|manual)
  - `ref_id` text (idempotency key)
  - `created_at` timestamptz default now()

Indexes:
- unique (reason, ref_type, ref_id) for idempotency
- index on user_id
- index on created_at

## Credits Service
File: `src/server/src/credits/creditsService.ts`

Functions:
- `getBalance(userId)`
  - ensures a balance row exists
  - returns `{ balance, updated_at }`

- `applyTopupFromMidtrans({ userId, orderId, amount })`
  - runs in a transaction
  - `SELECT ... FOR UPDATE` on `credits_balances`
  - inserts ledger row with (reason=topup, ref_type=midtrans_order, ref_id=orderId)
  - on conflict: no-op and returns current balance
  - on success: increments balance and updates `updated_at`

- `deductForLlm({ userId, requestId, amount })`
  - runs in a transaction
  - `SELECT ... FOR UPDATE` on `credits_balances`
  - if balance < amount: returns `insufficient_credits` and no ledger row
  - inserts ledger row with (reason=usage, ref_type=llm_request, ref_id=requestId)
  - on conflict: no-op and returns current balance
  - on success: decrements balance and updates `updated_at`

## LLM Deduction Enforcement
File: `src/server/src/index.ts`

Fixed costs (v1): `src/server/src/credits/creditsCosts.ts`
- paper-analyze: 10
- chat: 5
- prefill: 1

Behavior:
- LLM endpoints deduct credits after validation and concurrency checks but before calling the LLM provider.
- If insufficient, endpoint returns status 402 with code `insufficient_credits`.
- Deduction is idempotent by `requestId` (ledger unique constraint).

## Credits Balance Endpoint
- `GET /api/credits/me` (auth required)
- Returns `{ ok: true, balance, updated_at }`

## Midtrans Topup Integration
File: `src/server/src/index.ts`

- Webhook (`POST /api/payments/webhook`):
  - After a paid status is applied, the server looks up `user_id` and `gross_amount` for the order.
  - Calls `applyTopupFromMidtrans(...)` (idempotent).
- Status endpoint (`GET /api/payments/:orderId/status`):
  - If status indicates paid or `paid_at` already present, calls `applyTopupFromMidtrans(...)` (idempotent).

## Observability Additions
LLM logs now include:
- `credits_cost`
- `credits_balance_before`
- `credits_balance_after`

## Idempotency Guarantees
- Credits ledger has a unique key (reason, ref_type, ref_id).
- Replays of the same Midtrans order or LLM request do not double-apply credits.
- All balance mutations are transactional with row-level locks to prevent races.

## Verification Checklist
- Run migrations with `npm run migrate` from `src/server`.
- Create a paid Midtrans transaction and ensure credits increase once (webhook/status can be replayed safely).
- Attempt multiple concurrent LLM calls with low balance to confirm only one succeeds.
- Repeat the same requestId: confirm balance does not change twice.
