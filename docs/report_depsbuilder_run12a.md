# Run 12a Forensic Report: Deps Builder Map

Date: 2026-02-14
Scope: deps construction map only (no code changes)
Branch: wire-onboarding-screen-backend-refactoring

## Goal
Map all route dependency objects currently assembled in `src/server/src/serverMonolith.ts` and define a parity-safe seam for `src/server/src/server/depsBuilder.ts`.

## Route Modules and Deps Types

| Route module | Register function | Deps type | Current monolith assembly |
| --- | --- | --- | --- |
| `src/server/src/routes/healthRoutes.ts` | `registerHealthRoutes` | `HealthRouteDeps` | Inline literal at callsite (`{ getPool }`) |
| `src/server/src/routes/authRoutes.ts` | `registerAuthRoutes` | `AuthRouteDeps` | Inline literal at callsite |
| `src/server/src/routes/profileRoutes.ts` | `registerProfileRoutes` | `ProfileRouteDeps` | Inline literal at callsite |
| `src/server/src/routes/savedInterfacesRoutes.ts` | `registerSavedInterfacesRoutes` | `SavedInterfacesRouteDeps` | Inline literal at callsite |
| `src/server/src/routes/paymentsRoutes.ts` | `registerRupiahAndPaymentsCreateRoutes`, `registerPaymentsStatusRoute` | `PaymentsRouteDeps` | Shared object `paymentsRouteDeps` |
| `src/server/src/routes/paymentsWebhookRoute.ts` | `registerPaymentsWebhookRoute` | `PaymentsWebhookDeps` | Inline literal at callsite |
| `src/server/src/routes/llmAnalyzeRoute.ts` | `registerLlmAnalyzeRoute` | `LlmAnalyzeRouteDeps` | `llmAnalyzeRouteDeps` |
| `src/server/src/routes/llmPrefillRoute.ts` | `registerLlmPrefillRoute` | `LlmPrefillRouteDeps` | `llmPrefillRouteDeps` |
| `src/server/src/routes/llmChatRoute.ts` | `registerLlmChatRoute` | `LlmChatRouteDeps` | `llmChatRouteDeps` |

## Current Dep Sources (serverMonolith)

### Shared core services
- `getPool` from `src/server/src/db.ts`
- `requireAuth` local function in monolith
- `midtransRequest` from `src/server/src/midtrans/client.ts`
- `getBalance`, `applyTopupFromMidtrans` from `src/server/src/rupiah/rupiahService.ts`
- `assertAuthSchemaReady` for startup gates (not route deps)

### Env and config sourced values
- `serverEnv` from `loadServerEnvConfig()`:
  - `port`
  - `cookieName`, `sessionTtlMs`, `cookieSameSite`
  - `savedInterfacesListLimit`, `maxSavedInterfacePayloadBytes`, `savedInterfaceJsonLimit`
  - `isProd`, `devBypassBalanceEnabled`
  - `isOpenrouterAnalyzeAllowed`
  - CORS inputs and warning flag
- constants in monolith:
  - `PROFILE_DISPLAY_NAME_MAX`
  - `PROFILE_USERNAME_MAX`
  - `PROFILE_USERNAME_REGEX`

### Remaining direct process.env reads in monolith
- `process.env.MIDTRANS_SERVER_KEY` inside `verifyMidtransSignature(...)`
- `process.env.GOOGLE_CLIENT_ID` when assembling `AuthRouteDeps`

## Per-Route Dep Breakdown

### health
- `getPool`

### auth
- `getPool`
- cookie config: `COOKIE_NAME`, `COOKIE_SAMESITE`, `SESSION_TTL_MS`, `isProd()`
- `getProfileColumnsAvailable: () => profileColumnsAvailable`
- `googleClientId: process.env.GOOGLE_CLIENT_ID`
- `verifyGoogleIdToken` helper (monolith)

### profile
- `getPool`
- `requireAuth`
- `getProfileColumnsAvailable`
- profile validation constants

### saved interfaces
- `getPool`
- `requireAuth`
- `SAVED_INTERFACES_LIST_LIMIT`
- `MAX_SAVED_INTERFACE_PAYLOAD_BYTES`
- `logger: console`

### payments create/status
- `getPool`
- `requireAuth`
- `getBalance`
- `midtransRequest`
- `parseGrossAmount`
- `applyTopupFromMidtrans`
- `sanitizeActions`
- `isPaidStatus`

### payments webhook
- `getPool`
- `verifyMidtransSignature`
- `applyTopupFromMidtrans`
- `isPaidStatus`

### llm analyze/prefill/chat
- common deps object from:
  - `requireAuth`
  - `getUserId`
  - runtime counters and slot gates from `createLlmRuntimeState(...)`
  - requestflow helpers (`sendApiError`, `mapLlmErrorToStatus`, `mapTerminationReason`, `logLlmRequest`, `getUsageFieldList`, `getPriceUsdPerM`)
  - validation guard and dev bypass
- route-specific:
  - analyze: `isOpenrouterAnalyzeAllowed`
  - chat: streaming counter increment and decrement

## Clean Seam Plan (Parity-safe)

### Builder inputs
`buildRouteDeps` should consume:
- `cfg` (loaded once from env config)
- `services` object (getPool, requireAuth, payment helpers, llm helpers, logger)
- `getProfileColumnsAvailable` accessor

### Builder outputs
One object with per-route deps:
- `health`
- `auth`
- `profile`
- `savedInterfaces`
- `payments`
- `paymentsWebhook`
- `llmAnalyze`
- `llmPrefill`
- `llmChat`

### Constraints to preserve
1. Assembly only. No logic migration from routes.
2. Keep exact existing route dep type signatures.
3. Preserve webhook-before-cors registration ordering by wiring only.
4. Preserve startup order (`runStartupGates` before `listen`).
5. Move remaining monolith env reads into `envConfig` or builder single-read layer so env reads are centralized.

## Risks and Controls

| Risk | Why | Control |
| --- | --- | --- |
| Signature drift in route deps | Route modules already typed and validated by tests | Keep existing dep type contracts unchanged |
| Hidden behavior change during dep movement | Some deps are closures around env and runtime counters | Keep closure behavior identical, move assembly only |
| Order drift | Monolith currently enforces route registration order | Run 12c parity checklist and keep register order untouched |
| Env read drift | Remaining `process.env` reads are in monolith | Centralize `GOOGLE_CLIENT_ID` and `MIDTRANS_SERVER_KEY` in config/builder |

## Conclusion
Current code is ready for a strict builder seam. The safest implementation is object-assembly centralization with no route logic changes and no route order changes.
