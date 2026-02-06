# Rupiah Pricing Tuning: Abort Charging + Word Token Estimator

Date: 2026-02-06
Scope: streaming abort charging, word-based token estimation, model price placeholders

## Summary
Adjusted rupiah charging so streaming chat charges even when the client aborts, based on output generated so far. Replaced the placeholder token estimator from chars/4 to 1 word = 1 token. Updated combined USD per million token placeholders for mini and nano models.

## Changes

### 1) Streaming abort now charges partial output
File: `src/server/src/index.ts`

- Chat streaming now accumulates output text during streaming.
- In the `finally` block, the server computes token estimates from:
  - input text (full prompt sent)
  - output text produced so far
- Charging runs regardless of success or client abort.
- Idempotency is guaranteed via `rupiah_ledger` unique constraint on (reason, ref_type, ref_id).

Charging policy:
- `success`: charge full input + output
- `client_abort`: charge input + output produced so far
- `upstream_error/timeout`: charge input + output produced so far

### 2) Token estimation placeholder: 1 word = 1 token
File: `src/server/src/pricing/tokenEstimate.ts`

Estimator:
- Normalize whitespace
- Split by space
- Count non-empty words

Used for:
- Input estimates when usage is missing
- Output estimates for streaming partial charges
- Non-stream endpoints when usage is missing

### 3) Model combined price placeholders updated
File: `src/server/src/pricing/pricingConfig.ts`

Combined USD per 1M tokens:
- `gpt-5.2`: 15.75
- `gpt-5.1`: 11.25
- `gpt-5-mini`: 2.25
- `gpt-5-nano`: 0.45

Other constants (unchanged):
- `MARKUP_MULTIPLIER = 1.5`
- `USD_TO_IDR_PLACEHOLDER = 17000`

## Limitations / TODO
- Word-based estimator is placeholder; replace with real tokenizer later.
- FX rate is placeholder; replace with real-time FX or configured rate.
- Model prices are placeholders and should be updated from official pricing.

## Verification Checklist
- Start chat stream, abort after some text:
  - `rupiah_ledger` has one usage row for that request_id
  - `rupiah_balances` decreases > 0
- Repeat same request_id:
  - no double charge
- Full stream completes:
  - single charge based on total output words
- Analyzer and prefill still return ok with new estimator
