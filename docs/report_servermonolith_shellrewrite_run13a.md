# Run 13a Forensic Scan: ServerMonolith Shell Rewrite

Date: 2026-02-14
Scope: forensic scan only, no code changes

## Current Line Count
- `src/server/src/serverMonolith.ts`: 225 lines

## Remaining Non-Shell Logic In Monolith

### Local helper functions
1. `verifyGoogleIdToken(...)`
- Uses `OAuth2Client` directly.
- Non-shell concern: OAuth verification implementation.
- Extraction target: `src/server/src/auth/googleToken.ts`.

2. `parseGrossAmount(...)`
- Payments helper.
- Non-shell concern: data parsing logic.
- Extraction target: `src/server/src/payments/midtransUtils.ts`.

3. `sanitizeActions(...)`
- Payments response sanitizer.
- Non-shell concern: payload shaping logic.
- Extraction target: `src/server/src/payments/midtransUtils.ts`.

4. `isPaidStatus(...)`
- Payments status policy.
- Non-shell concern: domain rule.
- Extraction target: `src/server/src/payments/midtransUtils.ts`.

5. `verifyMidtransSignature(...)`
- Midtrans signature computation logic.
- Non-shell concern: payment signature verification.
- Extraction target: `src/server/src/payments/midtransUtils.ts`.

6. `isValidationError(...)`
- LLM validation shape guard.
- Lightweight helper, can stay in bootstrap shell or move later if needed.

7. `getUserId(...)`
- Lightweight helper for LLM deps.
- Can stay local in bootstrap or move to llm util later.

8. `isProd()` and `isDevBalanceBypassEnabled()`
- Thin wrappers over `serverEnv` fields.
- Can be inlined in builder services setup.

### Middleware still local in monolith
1. `requireAuth(...)`
- Full auth middleware logic with DB query and cookie clear behavior.
- Non-shell concern.
- Extraction target: `src/server/src/auth/requireAuth.ts` as factory.

### Runtime construction still local in monolith
1. `const llmRuntime = createLlmRuntimeState({ maxConcurrentLlm: 2 })`
2. `llmRuntime.startPeriodicLog(60000)`
3. `llmRouteCommonDeps` object assembly
- Not route handler logic, but still runtime orchestration details.
- Can remain in bootstrap orchestrator without violating shell intent.

### Route registration state
- All route handlers are already extracted to route modules.
- Monolith currently performs registration and startup ordering only.

## Order Markers To Preserve Exactly
1. `applyJsonParsers(...)` before any route registration.
2. `registerPaymentsWebhookRoute(...)` before `app.use(cors(...))`.
3. CORS registration:
   - `app.use(cors(corsOptions))`
   - `app.options(/.*/, cors(corsOptions))`
4. Route order after CORS:
   - health
   - auth
   - profile
   - saved-interfaces
   - rupiah/payments create
   - llm analyze
   - payments status
   - llm prefill
   - llm chat
5. Startup sequence before listen:
   - `runStartupGates(...)`
   - set `profileColumnsAvailable`
   - `app.listen(...)`

## Clean Extraction Feasibility

### Safe in run13b (parity-preserving)
1. Move OAuth verifier implementation to `auth/googleToken.ts`.
2. Move payments helper functions to `payments/midtransUtils.ts`.
3. Move `requireAuth` to `auth/requireAuth.ts` factory with current behavior.

### Safe in run13c
1. Move orchestration body to `server/bootstrap.ts`.
2. Reduce `serverMonolith.ts` to startup shell import/call.
3. Preserve `src/server/src/index.ts` side-effect startup behavior.

### No-go changes for this run
1. Do not change route module deps types.
2. Do not reorder route registration.
3. Do not alter auth/payments error strings or status behavior.

## Conclusion
The remaining non-shell logic is limited and extractable with low risk. After run13b and run13c, `serverMonolith.ts` can be reduced to a thin shell while keeping all established order-sensitive contracts intact.
