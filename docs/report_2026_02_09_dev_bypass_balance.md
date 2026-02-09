# Report: Dev Balance Bypass for Local LLM Testing
Date: 2026-02-09

## Summary
Added a dev-only balance bypass so developers can test analysis/chat/prefill using their own LLM keys without rupiah balance friction.

Guard policy:
- Frontend bypass: `import.meta.env.DEV && VITE_DEV_BYPASS_BALANCE=1`
- Backend bypass: `!isProd() && DEV_BYPASS_BALANCE=1`
- Production behavior is unchanged.

## Scope
Implemented the bypass in both frontend and backend gates.

Files changed:
- `src/money/ensureSufficientBalance.ts`
- `src/server/src/index.ts`

## Frontend Changes
### `src/money/ensureSufficientBalance.ts`
- Added helper:
  - `isDevBalanceBypassEnabled()`
- Early-return `true` in `ensureSufficientBalance(...)` when bypass is enabled.
- Effect:
  - analysis/chat/prefill precheck no longer blocks in dev bypass mode.
  - shortage modal is not triggered by precheck during bypass.

## Backend Changes
### `src/server/src/index.ts`
- Added helper near runtime env utilities:
  - `isDevBalanceBypassEnabled()`
- Applied bypass in all three LLM endpoints:
  - `POST /api/llm/paper-analyze`
  - `POST /api/llm/prefill`
  - `POST /api/llm/chat`

For each endpoint:
1. Pre-check balance gate:
   - If bypass disabled: existing insufficient flow unchanged.
   - If bypass enabled: skip insufficient rejection.
2. Post-usage charge gate:
   - If bypass disabled: existing `chargeForLlm` behavior unchanged.
   - If bypass enabled: skip charge call and mark audit fields as bypassed.

Audit behavior in bypass mode:
- `auditChargeStatus = "bypassed_dev"`
- `auditChargeError = null`
- `auditCostIdr = 0`
- `auditBalanceBefore = null`
- `auditBalanceAfter = null`

## How to Use
Frontend env:
- Set `VITE_DEV_BYPASS_BALANCE=1`

Backend env:
- Set `DEV_BYPASS_BALANCE=1`

Notes:
- Keep valid auth/session (requireAuth is unchanged).
- Keep valid backend provider key (`OPENAI_API_KEY` and/or routed provider keys).

## Safety
- Bypass is not active in production due to `isProd()` guard.
- No auth bypass was introduced.
- No endpoint response contract changes were introduced.

## Verification Checklist
1. Dev bypass OFF with low/zero balance:
   - paid actions can still return insufficient behavior.
2. Dev bypass ON with low/zero balance:
   - analysis/prefill/chat should proceed.
3. Production runtime with bypass env set:
   - bypass should be ignored.
