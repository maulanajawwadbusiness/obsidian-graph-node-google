# Rupiah Pricing Placeholder Foundation

Date: 2026-02-06
Scope: rupiah tables, pricing config, pricing calculator, and LLM charging hooks

## Summary
Replaced the previous credits concept with a rupiah-based balance and ledger. Added a pricing configuration based on per-token cost with a 150 percent markup and a placeholder USD to IDR rate. LLM endpoints now pre-check balance and charge after completion using token usage when available, with explicit limitations for streaming.

## Pricing Configuration (Server Source of Truth)
File: `src/server/src/pricing/pricingConfig.ts`

- `MODEL_PRICE_USD_PER_MTOKEN_COMBINED`
  - `gpt-5.2` = 15.75
  - `gpt-5.1` = 11.25
  - `gpt-5-nano` = 2.5 (placeholder)
- `MARKUP_MULTIPLIER` = 1.5
- `USD_TO_IDR_PLACEHOLDER` = 17000
- `getModelUsdPerToken(model)` returns USD per token

## Pricing Calculator
File: `src/server/src/pricing/pricingCalculator.ts`

Function:
```
estimateIdrCost({ model, inputTokens, outputTokens })
```

Formula:
- `totalTokens = inputTokens + outputTokens`
- `usdCost = totalTokens * usdPerToken(model)`
- `usdPrice = usdCost * MARKUP_MULTIPLIER`
- `idrPrice = usdPrice * USD_TO_IDR_PLACEHOLDER`
- `idrCostRounded = ceil(idrPrice)`

## Schema (node-pg-migrate)
Migration: `src/server/migrations/1770379000000_add_rupiah_tables.js`

Tables:
- `rupiah_balances`
  - `user_id` bigint PK, FK -> `users(id)`
  - `balance_idr` bigint not null default 0
  - `updated_at` timestamptz default now()

- `rupiah_ledger`
  - `id` uuid PK (app-generated)
  - `user_id` bigint FK -> `users(id)`
  - `delta_idr` bigint
  - `reason` text (topup|usage|refund|adjustment)
  - `ref_type` text (midtrans_order|llm_request)
  - `ref_id` text (order_id or request_id)
  - `created_at` timestamptz default now()

Indexes:
- unique (reason, ref_type, ref_id) for idempotency
- index on user_id
- index on created_at

## Rupiah Service
File: `src/server/src/rupiah/rupiahService.ts`

Functions:
- `getBalance(userId)`
- `applyTopupFromMidtrans({ userId, orderId, amountIdr })`
- `chargeForLlm({ userId, requestId, amountIdr, meta })`

Guarantees:
- All mutations run inside transactions.
- `SELECT ... FOR UPDATE` used to prevent balance races.
- Idempotency enforced by unique ledger constraint.

## Endpoints
- `GET /api/rupiah/me` (auth)
  - returns `{ ok: true, balance_idr, updated_at }`

Midtrans integration:
- Webhook and status endpoints apply topups via `applyTopupFromMidtrans(...)` using `gross_amount` as IDR.

## LLM Charging Hooks (Placeholder)
File: `src/server/src/index.ts`

Behavior per endpoint:
- Pre-check balance using an estimate based on input size (tokens ~= chars/4).
- Call OpenAI.
- Charge after successful response using usage tokens if provided, else fallback to estimates.

Errors:
- If insufficient at pre-check or charge time:
  - response `402` with
  ```
  { ok:false, code:"insufficient_rupiah", request_id, needed_idr, balance_idr, shortfall_idr }
  ```

Streaming limitation:
- Chat streaming charges after stream completes using estimated token counts from output chars.
- If the client aborts, no charge is performed.

## Placeholder Notes
- `USD_TO_IDR_PLACEHOLDER` is a temporary FX rate.
- `gpt-5-nano` price is a placeholder.
- Token counts for streaming are estimated from character counts.

## Verification Checklist
- Run migrations with `npm run migrate` from `src/server`.
- Confirm `GET /api/rupiah/me` returns balance.
- Trigger a paid Midtrans event and confirm `rupiah_balances` increases once.
- Run LLM endpoint with low balance to confirm `insufficient_rupiah` error.
- Run LLM endpoint with balance and confirm ledger entry is created.
