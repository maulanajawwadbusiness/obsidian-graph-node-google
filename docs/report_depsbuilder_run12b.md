# Run 12b Report: depsBuilder Module Added

Date: 2026-02-14
Scope: add builder module only, no monolith wiring yet

## Added Files
- `src/server/src/server/depsBuilder.ts`

## Updated Files
- `src/server/src/server/envConfig.ts`

## Exported API

### `CoreServices`
Builder input service bag with existing runtime seams:
- db/auth: `getPool`, `requireAuth`, `verifyGoogleIdToken`
- payments: `getBalance`, `midtransRequest`, `parseGrossAmount`, `applyTopupFromMidtrans`, `sanitizeActions`, `isPaidStatus`, `verifyMidtransSignature(payload, serverKey)`
- llm: `llmCommon`, `llmStreaming`
- optional `logger`

### `BuiltRouteDeps`
Builder output per route registrar:
- `health`
- `auth`
- `profile`
- `savedInterfaces`
- `payments`
- `paymentsWebhook`
- `llmAnalyze`
- `llmPrefill`
- `llmChat`

### `buildRouteDeps(...)`
Pure object assembly. No route registration and no route logic changes.

## Env Reads Centralized in Config
`envConfig` now includes:
- `googleClientId` (from `GOOGLE_CLIENT_ID`)
- `midtransServerKey` (from `MIDTRANS_SERVER_KEY`)

This allows next wiring step to remove direct `process.env` reads from monolith route deps assembly.

## Parity Notes
1. Route logic is untouched.
2. Registration order is untouched in this run.
3. Builder uses current defaults and existing helper function contracts.
4. Payments webhook signature function remains the same route-level contract (`payload -> boolean`) by using a closure over `cfg.midtransServerKey`.

## Result
Run12b introduces a reusable deps assembly seam and keeps runtime behavior unchanged because monolith still owns active wiring in this step.
