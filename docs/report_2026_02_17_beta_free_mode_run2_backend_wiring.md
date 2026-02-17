# Run 2 Report: Wire BETA_FREE_MODE into Backend Bypass
Date: 2026-02-17
Run scope: Route-level bypass decision wiring for beta free mode in backend.

## Changes made
- Updated `src/server/src/routes/llmRouteDeps.ts`:
  - Added `isBetaFreeModeEnabled: () => boolean` to `LlmRouteCommonDeps`.
- Updated `src/server/src/server/bootstrap.ts`:
  - Added `isBetaFreeModeEnabled()` from `serverEnv.betaFreeModeEnabled`.
  - Added one boot log line when enabled:
    - `[billing] BETA_FREE_MODE enabled: bypassing payment gates`
  - Wired the new function into `llmRouteCommonDeps`.
- Updated route bypass decision points:
  - `src/server/src/routes/llmAnalyzeRoute.ts`
  - `src/server/src/routes/llmPrefillRoute.ts`
  - `src/server/src/routes/llmChatRoute.ts`
  - New decision: `bypassBalance = devBypass || betaFreeMode`.

## Behavior impact
- With backend `BETA_FREE_MODE=1`, all three LLM routes bypass rupiah precheck and charge gates.
- `requireAuth` remains unchanged on all three routes.
- Existing behavior remains unchanged when `BETA_FREE_MODE` is unset or `0`.

## Hidden payment gate scan result (this run)
- Hard payment enforcement still only routes through `precheckBalance(...)` and `chargeUsage(...)` in LLM routes.
- No additional 402 gate was introduced outside those seams.

## Verification
- Commands run from `src/server`:
  - `npm run build`
  - `npm run test:servermonolith-shell`
  - `npm run test:depsbuilder-contracts`
- Result: pass.
