# Report: Server Monolith Forensic Scan and Modularization Plan

Date: 2026-02-14
Author: Codex (forensic pass only, no runtime code changes)
Target file: `src/server/src/serverMonolith.ts`

## 1. Objective

Produce a sharp forensic analysis of `serverMonolith.ts`, map all concerns and wiring, and define a safe modularization path to reduce the orchestrator file to under 450 lines while preserving behavior and contracts.

This report follows the current backend truth in:
- `docs/system.md`
- `docs/repo_xray.md`

## 2. Scope and Method

Work performed:
1. Read `docs/system.md` and `docs/repo_xray.md` in full.
2. Read `src/server/src/serverMonolith.ts` end to end with line-level mapping.
3. Read supporting server modules to confirm existing seams:
   - `src/server/src/llm/*`
   - `src/server/src/rupiah/rupiahService.ts`
   - `src/server/src/fx/fxService.ts`
   - `src/server/src/midtrans/client.ts`
   - `src/server/src/db.ts`
   - `src/server/src/authSchemaGuard.ts`
4. Produce concern map, coupling map, risk map, and phased split plan.

No code was modified in this pass.

## 3. Contract Baseline from System Docs

Backend constraints that are non-negotiable during refactor:

1. Auth state source of truth:
   - `/me` is authoritative.
   - session cookie is `arnvoid_session`.
   - frontend calls must use `credentials: "include"`.

2. Backend route ownership:
   - Route behavior currently owned by `src/server/src/serverMonolith.ts`.
   - `src/server/src/index.ts` is a thin import entry.

3. Saved interfaces contract:
   - `GET /api/saved-interfaces`
   - `POST /api/saved-interfaces/upsert`
   - `POST /api/saved-interfaces/delete`
   - payload size guard defaults to 15 MB.
   - ordering truth is payload timestamps, not DB metadata timestamps.

4. LLM contract:
   - endpoints: paper analyze, chat, prefill.
   - provider policy routing, usage tracking, audit persistence, rupiah billing, free pool ledger.

5. Payments contract:
   - GoPay QRIS create/status/webhook.
   - webhook persistence and signature verification behavior must remain stable.

## 4. Current Monolith Anatomy

## 4.1 High-level

`src/server/src/serverMonolith.ts` has three major layers:
1. Boot/config/helpers/middleware globals.
2. Route handlers across auth/profile/saved interfaces/rupiah/payments/llm.
3. Startup gate (`assertAuthSchemaReady`, profile column detection, listen).

## 4.2 Route footprint by line span

Measured route blocks:

1. `POST /api/payments/webhook` - lines 437-549 (113 lines)
2. `GET /health` - lines 550-559 (10 lines)
3. `POST /auth/google` - lines 560-682 (123 lines)
4. `GET /me` - lines 683-746 (64 lines)
5. `POST /auth/logout` - lines 747-763 (17 lines)
6. `POST /api/profile/update` - lines 764-835 (72 lines)
7. `GET /api/saved-interfaces` - lines 836-862 (27 lines)
8. `POST /api/saved-interfaces/upsert` - lines 863-926 (64 lines)
9. `POST /api/saved-interfaces/delete` - lines 927-952 (26 lines)
10. `GET /api/rupiah/me` - lines 953-962 (10 lines)
11. `POST /api/payments/gopayqris/create` - lines 963-1061 (99 lines)
12. `POST /api/llm/paper-analyze` - lines 1062-1638 (577 lines)
13. `GET /api/payments/:orderId/status` - lines 1639-1749 (111 lines)
14. `POST /api/llm/prefill` - lines 1750-2183 (434 lines)
15. `POST /api/llm/chat` - lines 2184-2622 (streaming-heavy block)
16. Startup - lines 2623-2640

Observation:
- Three LLM routes dominate file size and complexity.
- Analyze route alone is larger than the desired final target size for the entire orchestrator.

## 4.3 Import and dependency concentration

Imports at top include:
- core web stack: `express`, `cors`
- auth verification: `google-auth-library`
- DB and schema guard
- LLM analyze prompt/schema/adapter
- provider router and provider getter
- usage tracker and audit writer
- pricing and FX
- rupiah balance/charge/topup
- Midtrans client

Result:
- `serverMonolith.ts` is both composition root and domain implementation root.
- It currently owns too many policy decisions and transaction sequences.

## 5. Middleware and Wiring Forensics

## 5.1 Parser and size-limit wiring

Key middleware behavior:
- dedicated JSON parser for `/api/saved-interfaces` with `SAVED_INTERFACE_JSON_LIMIT`.
- global JSON parser with `LLM_LIMITS.jsonBodyLimit`.
- explicit `entity.too.large` handler that maps saved-interface overlimit to 413.

Refactor sensitivity:
- registration order must remain exact.
- splitting into files must not alter this parser branching behavior.

## 5.2 CORS and route ordering

Current order:
1. Webhook route is registered before global CORS middleware.
2. Then `app.use(cors(corsOptions))` and `app.options(...)`.

Refactor sensitivity:
- preserve this ordering to avoid behavior drift on webhook and preflight handling.

## 5.3 Startup gate

Startup path:
1. `assertAuthSchemaReady()`
2. `detectProfileColumnsAvailability()`
3. listen

Refactor sensitivity:
- startup guard must remain centralized.
- profile column readiness state is consumed by auth/me/profile logic.

## 6. Domain Forensics by Concern

## 6.1 Auth and session concern

Routes:
- `/auth/google`
- `/me`
- `/auth/logout`
- middleware `requireAuth`

Key behavior:
- verify Google id token.
- upsert user row.
- create session row.
- set secure cookie config from env and prod status.
- on invalid session, clear cookie.
- `/me` returns profile fields when optional columns exist.

Shared load-bearing pieces:
- `parseCookies`, `resolveCookieOptions`, `clearSessionCookie`
- `profileColumnsAvailable`
- DB query shape differs depending on profile column availability.

## 6.2 Profile concern

Route:
- `POST /api/profile/update` (requireAuth)

Behavior:
- validates `displayName` and `username`.
- enforces max lengths and username regex.
- requires profile schema readiness.
- returns same user envelope shape expected by frontend.

## 6.3 Saved interfaces concern

Routes:
- list/upsert/delete with requireAuth.

Behavior:
- server-side payload serializability and byte-size guard.
- DB upsert keyed by `(user_id, client_interface_id)`.
- route returns DB timestamps in API payload.

Coupling note:
- even though backend query sorts by DB `updated_at`, frontend contract states ordering truth is payload timestamps. This is currently tolerated due frontend merge/order logic, but this area is sensitive and must not regress.

## 6.4 Payments concern (Midtrans + Rupiah)

Routes:
- webhook
- create GoPay QRIS charge
- payment status polling
- rupiah balance getter

Behavior:
- webhook stores event row first, marks processed, and applies topup idempotently through ledger-based service.
- create route persists transaction row before Midtrans charge request, then updates row with response.
- status route syncs pending transactions from Midtrans and applies topup when settled/captured.

Risk points:
- multi-step DB and external call sequences are easy to regress if split without preserving transaction boundaries and idempotency assumptions.

## 6.5 LLM concern

Routes:
- `/api/llm/paper-analyze`
- `/api/llm/prefill`
- `/api/llm/chat` (streaming)

Shared behavior sequence (highly duplicated):
1. request id, counters
2. validate input
3. per-user concurrent slot gate
4. pick provider by policy
5. map provider model id
6. initialize usage tracker
7. estimate pre-charge from input tokens + FX
8. pre-balance check unless dev bypass
9. call provider (structured/text/stream)
10. finalize usage (provider usage or tokenizer/estimate fallback)
11. charge rupiah
12. record openai free pool spend when eligible
13. write audit
14. write operational request log
15. release slot and counters

Analyze-specific behavior:
- openrouter structured mode with retry and strict validation.
- forced fallback to openai based on allowlist env flags.

Chat-specific behavior:
- streaming response with request close handling.
- end-of-stream usage finalization and charge performed in finally.

Operational state:
- global counters and `setInterval` metric logging inside monolith.

## 7. Coupling and Duplication Hotspots

## 7.1 Global mutable state in monolith

Current globals in one file:
- `profileColumnsAvailable`
- per-user concurrency map
- request inflight/streaming counters

These should move to dedicated runtime state modules, then be injected or imported intentionally.

## 7.2 Audit field boilerplate repeated per endpoint

Each LLM route declares near-identical audit state bags and `writeAudit()` wrapper. This repetition is a primary source of line growth and refactor risk.

## 7.3 Error and termination mapping repeated in route branches

Status mapping, termination reason mapping, and API error shape are centralized helpers already, but are still used through repeated route-local branches.

## 7.4 Balance check and charge flow repeated

Pre-estimate insufficient balance check and post-usage charge logic are duplicated with minor differences across analyze/prefill/chat.

## 7.5 Request header and logging consistency issues

Observed repeated `X-Request-Id` header set calls in analyze insufficient-balance branches. This is not catastrophic, but is a signal of copy-paste drift and poor consolidation.

## 8. Why It Is 2600+ Lines

Not because Express requires this size. It is large due to four factors:
1. Domain concentration (all concerns implemented in one file).
2. Heavy LLM route logic with many branches.
3. Repeated audit/billing/provider workflow across three endpoints.
4. Co-locating setup/middleware/helpers/routes/startup in a single unit.

## 9. Target Architecture for Refactor

Goal:
- Keep `serverMonolith.ts` as composition orchestrator only.
- Push domain behavior into route modules and small shared service helpers.
- Keep behavior parity.

Proposed structure:

```text
src/server/src/
  serverMonolith.ts                # composition + startup only (target < 450)
  server/
    appFactory.ts                  # create app + trust proxy + parser wiring + cors wiring
    corsConfig.ts                  # allowed origins and cors options
    jsonParsers.ts                 # parser split and too-large handler
    cookies.ts                     # parseCookies, cookie options, clear cookie
    authContext.ts                 # shared AuthContext types and locals typing
    requireAuth.ts                 # requireAuth middleware
    envConfig.ts                   # server env constants
  routes/
    healthRoutes.ts
    authRoutes.ts
    profileRoutes.ts
    savedInterfacesRoutes.ts
    paymentsRoutes.ts
    llmAnalyzeRoute.ts
    llmPrefillRoute.ts
    llmChatRoute.ts
  llm/
    runtimeState.ts                # concurrency map + counters + tick logger
    requestLog.ts                  # logLlmRequest + error helpers
    auditBuilder.ts                # audit state init + finalize helpers
    billingFlow.ts                 # estimate, precheck, charge, freepool helpers
```

Design principle:
- Concern-first extraction, not arbitrary slicing.
- Keep each route module explicit and testable.
- Introduce reusable LLM flow helpers only after first extraction keeps parity.

## 10. Phased Execution Plan (Safe Sequence)

Phase 1: App composition seam
1. Create app factory and middleware wiring modules.
2. Keep all route logic in monolith temporarily.
3. Verify startup and middleware behavior parity.

Phase 2: Low-risk route extraction
1. Extract health route.
2. Extract auth/profile routes.
3. Extract saved interfaces routes.
4. Verify all non-LLM flows.

Phase 3: Payment extraction
1. Extract webhook/create/status/rupiah routes into payments module.
2. Keep current SQL and topup calls unchanged.
3. Verify webhook idempotent behavior and status polling behavior.

Phase 4: LLM route extraction without dedup first
1. Move analyze/prefill/chat into route modules with minimal logic changes.
2. Keep shared helpers imported from existing modules.
3. Confirm parity in status codes, headers, audit writes, and logs.

Phase 5: LLM dedup pass
1. Extract common audit/billing/provider flow helpers.
2. Remove repeated state boilerplate.
3. Re-verify all branch outcomes.

Phase 6: Final trim and cleanup
1. Remove dead helpers from monolith.
2. Keep `serverMonolith.ts` as orchestrator and startup only.
3. Ensure file is under 450 lines.

## 11. Risk Register and Mitigation

Risk: middleware order drift
- Mitigation: keep parser and cors registration order identical in app factory.

Risk: auth cookie behavior drift
- Mitigation: centralize cookie helpers and reuse exactly in auth/me/logout.

Risk: profile column feature gate drift
- Mitigation: keep a single startup-resolved flag and pass to auth/profile route registration.

Risk: payment idempotency drift
- Mitigation: preserve current call path to `applyTopupFromMidtrans` and transaction updates.

Risk: streaming chat regressions
- Mitigation: preserve `req.on("close")`, stream usage promise handling, and finalize-in-finally semantics.

Risk: audit schema field drift
- Mitigation: typed audit helper with explicit field mapping; compare inserted fields with current output.

Risk: status code contract regressions
- Mitigation: endpoint-by-endpoint response contract checklist (success + known failure branches).

## 12. Verification Matrix for Refactor

Manual verification required:

1. Auth:
- login sets cookie and returns user
- `/me` returns signed-in payload
- logout clears cookie

2. Profile:
- invalid username rejected
- valid update persisted and returned

3. Saved interfaces:
- list, upsert, delete all work
- oversize payload returns 413

4. Payments:
- create returns order and actions
- status route returns stable payload
- webhook path stores event and finalizes processing

5. LLM:
- analyze success and validation errors
- prefill success and insufficient balance
- chat stream emits text and handles client abort
- audit rows written for each endpoint
- rupiah charge and freepool ledger behavior preserved

6. Ops:
- periodic llm metric logs still emitted
- request logs keep current fields

## 13. Completion Criteria

Refactor is done when all are true:
1. `src/server/src/serverMonolith.ts` is below 450 lines.
2. Behavior parity validated across auth/profile/saved interfaces/payments/llm.
3. Startup schema guard and profile column detection unchanged in effect.
4. Route and response contracts from `docs/system.md` remain true.
5. Documentation updated to point to new route module ownership.

## 14. Immediate Next Action

Start Phase 1 and Phase 2 first, with no LLM dedup yet:
- establish composition seams,
- extract auth/profile/saved interfaces/payments routes,
- keep LLM extraction for after core route modules are stable.

This order reduces blast radius while creating the skeleton needed to land the large LLM splits safely.

