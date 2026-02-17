# Run 3 Report: Audit Labeling and Bypass Reason Guardrails
Date: 2026-02-17
Run scope: Make bypass audit labeling accurate for beta mode and keep billing bypass safe.

## Changes made
- Updated `src/server/src/llm/billingFlow.ts`:
  - Added `BalanceBypassReason = "dev" | "beta" | null`.
  - Added `getBypassChargeStatus(reason)` mapping:
    - `beta` -> `bypassed_beta`
    - `dev` (or null fallback) -> `bypassed_dev`
  - Extended `chargeUsage(...)` input with `bypassReason`.
  - Bypass return path now uses mapped status instead of hardcoded `bypassed_dev`.
- Updated routes to compute bypass reason once and pass through:
  - `src/server/src/routes/llmAnalyzeRoute.ts`
  - `src/server/src/routes/llmPrefillRoute.ts`
  - `src/server/src/routes/llmChatRoute.ts`
  - Decision priority: beta over dev when both toggles are true.
  - Precheck bypass audit status now also uses mapped status.

## Audit behavior after this run
- Dev bypass path writes `charge_status = bypassed_dev`.
- Beta free mode bypass path writes `charge_status = bypassed_beta`.
- Non-bypass charge path remains unchanged (`charged` or `failed`).

## Robustness notes
- Bypass path still returns early from `chargeUsage(...)` and does not attempt rupiah ledger charge.
- No schema migration required for charge status values because audit writes status as string.
- `requireAuth` and slot/rate-limiting behavior unchanged.

## Verification
- Command run from `src/server`:
  - `npm run build`
- Result: pass.
