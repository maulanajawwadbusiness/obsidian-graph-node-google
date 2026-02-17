# Run 4 Report: Frontend Env Plumbing for Balance Preflight Bypass
Date: 2026-02-17
Run scope: Optional frontend toggle for UI preflight bypass.

## Changes made
- Updated `src/money/ensureSufficientBalance.ts`.
- Extended bypass predicate to include beta mode:
  - existing: `import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_BALANCE === '1'`
  - added: `import.meta.env.VITE_BETA_FREE_MODE === '1'`

## Behavior impact
- When `VITE_BETA_FREE_MODE=1`:
  - `ensureSufficientBalance(...)` returns `true` immediately.
  - No balance fetch/wait loop is needed for preflight.
  - No preflight shortage modal is triggered from this function.
- When unset or `0`:
  - behavior is unchanged from existing logic.

## UX summary by mode
- Backend ON, frontend ON:
  - No client-side insufficient preflight interruption.
  - Backend is already bypassing payment gates.
- Backend ON, frontend OFF:
  - App still works because backend is source of truth.
  - Client may still run preflight and show local shortage UI before request.
- Backend OFF, frontend ON:
  - Backend still enforces payment and may return 402.

## Verification
- Commands run:
  - Root: `npm run build`
  - `src/server`: `npm run build`
- Result: pass.
