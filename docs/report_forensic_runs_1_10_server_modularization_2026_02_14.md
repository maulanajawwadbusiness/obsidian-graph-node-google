# Forensic Report: ServerMonolith Modularization Runs 1-10

Date: 2026-02-14
Branch: wire-onboarding-screen-backend-refactoring
Scope: consolidated forensic report for backend modularization runs 1-10
Authoring basis: git history, per-run docs, current code state

## 1. Executive Summary

Runs 1-10 were completed as staged seam extraction with parity-first guardrails:

1. Run 1: env/constants seam (`run1a` to `run1c`)
2. Run 2: cookie seam (`run2a` to `run2c`)
3. Run 3: json parser seam (`run3a` to `run3c`)
4. Run 4: cors seam (`run4a` to `run4c`)
5. Run 5: startup gates seam (`run5a` to `run5c`)
6. Run 6: health routes extraction (`run6a` to `run6c`)
7. Run 7: auth routes extraction and hardening (`run7a` to `run7d`)
8. Run 8: profile route extraction (`run8a` to `run8c`)
9. Run 9: saved-interfaces routes extraction (`run9a` to `run9c`)
10. Run 10: payments route split including webhook pre-cors seam (`run10a` to `run10d`)

Global outcome:
- `src/server/src/serverMonolith.ts` reduced to 302 lines from the locked run0 baseline of 968 lines.
- net reduction from run0 baseline: 666 lines.
- order-sensitive contracts were preserved with route-level and seam-level contract guards.

## 2. Baseline and End State

Prerequisite baseline lock:
- run0 contract bible doc: `docs/report_servermonolith_contract_baseline_run0.md`
- baseline monolith line count: 968

Current state after run10d:
- `src/server/src/serverMonolith.ts` line count: 302
- monolith role is now wiring plus shared auth helper and llm deps composition
- extracted route modules cover health, auth, profile, saved-interfaces, rupiah, payments create/status, payments webhook, and llm routes

## 3. Detailed Timeline (Runs 1-10)

### Run 1: Env/constants seam

Commits:
- `48423de` chore(server): add envConfig module (run1a)
- `f882515` refactor(server): wire serverMonolith to envConfig (run1b)
- `14ae2dd` docs(server): add envConfig parity scan (run1c)

Artifacts:
- `src/server/src/server/envConfig.ts`
- `docs/report_envconfig_run1a.md`
- `docs/report_envconfig_run1b.md`
- `docs/report_envconfig_run1c.md`

Key preserved contracts:
- prod detection, dev bypass, allowed origins behavior, cookie/session defaults, saved-interface limits

### Run 2: Cookie seam

Commits:
- `ea42082` chore(server): add cookies utilities module (run2a)
- `648d69f` refactor(server): move cookie helpers to cookies.ts (run2b)
- `a627848` docs(server): add cookie seam parity scan (run2c)

Artifacts:
- `src/server/src/server/cookies.ts`
- `docs/report_cookies_run2a.md`
- `docs/report_cookies_run2b.md`
- `docs/report_cookies_run2c.md`

Key preserved contracts:
- cookie name/options, set/clear semantics, session extraction and sameSite normalization

### Run 3: JSON parser seam

Commits:
- `624e5bf` chore(server): add jsonParsers module (run3a)
- `1bfcbe1` refactor(server): wire serverMonolith to jsonParsers seam (run3b)
- `cf0ed8f` test(server): lock json parser contract guards (run3c)

Artifacts:
- `src/server/src/server/jsonParsers.ts`
- `src/server/scripts/test-jsonparsers-contracts.mjs`
- `docs/report_jsonparsers_run3a.md`
- `docs/report_jsonparsers_run3b.md`
- `docs/report_jsonparsers_run3c.md`

Key preserved contracts:
- saved-interfaces parser mounted first
- global parser skip for `/api/saved-interfaces`
- custom 413 message for saved-interfaces only

### Run 4: CORS seam

Commits:
- `838804c` chore(server): add corsConfig module (run4a)
- `383533f` refactor(server): wire serverMonolith to cors seam (run4b)
- `82bdc43` test(server): lock cors contract guards (run4c)

Artifacts:
- `src/server/src/server/corsConfig.ts`
- `src/server/scripts/test-cors-contracts.mjs`
- `docs/report_cors_run4a.md`
- `docs/report_cors_run4b.md`
- `docs/report_cors_run4c.md`

Key preserved contracts:
- webhook-before-cors invariant
- allowed/blocked origin behavior and headers
- preflight behavior and allowed methods/headers

### Run 5: Startup gates seam

Commits:
- `621dc9d` chore(server): add startupGates module (run5a)
- `bca76b2` refactor(server): wire serverMonolith to startupGates seam (run5b)
- `ba70c75` test(server): lock startup gates contract guards (run5c)

Artifacts:
- `src/server/src/server/startupGates.ts`
- `src/server/scripts/test-startupgates-contracts.mjs`
- `docs/report_startupgates_run5a.md`
- `docs/report_startupgates_run5b.md`
- `docs/report_startupgates_run5c.md`

Key preserved contracts:
- startup order `assertAuthSchemaReady -> detectProfileColumnsAvailability -> listen`
- fatal startup exit behavior
- profile columns runtime flag semantics

### Run 6: Health routes extraction

Commits:
- `b09c3d1` chore(server): add healthRoutes module (run6a)
- `852d9b1` refactor(server): wire health routes module (run6b)
- `5c7d8ef` test(server): lock health route contract guards (run6c)

Artifacts:
- `src/server/src/routes/healthRoutes.ts`
- `src/server/scripts/test-health-contracts.mjs`
- `docs/report_healthroutes_run6a.md`
- `docs/report_healthroutes_run6b.md`
- `docs/report_healthroutes_run6c.md`

Key preserved contracts:
- `GET /health` status/body and DB ping behavior

### Run 7: Auth routes extraction and hardening

Commits:
- `2b5bff1` chore(server): add authRoutes module (run7a)
- `80a590e` refactor(server): wire auth routes module (run7b)
- `2a1e1d5` test(server): lock /me + logout cookie contract guards (run7c)
- `d847930` test(auth): lock /auth/google contract guards (run7d)

Artifacts:
- `src/server/src/routes/authRoutes.ts`
- `src/server/scripts/test-auth-me-contracts.mjs`
- `src/server/scripts/test-auth-google-contracts.mjs`
- `docs/report_authroutes_run7a.md`
- `docs/report_authroutes_run7b.md`
- `docs/report_authroutes_run7c.md`
- `docs/report_authroutes_run7d.md`

Key preserved contracts:
- `/auth/google`, `/me`, `/auth/logout` response and cookie behavior
- `/me` user-null semantics and session clear behavior
- profileColumnsAvailable use in auth payload/query shape

### Run 8: Profile route extraction

Commits:
- `696f459` chore(server): add profileRoutes module (run8a)
- `dff5ecd` refactor(server): wire profile routes module (run8b)
- `6d486c9` test(profile): lock profile update contract guards (run8c)

Artifacts:
- `src/server/src/routes/profileRoutes.ts`
- `src/server/scripts/test-profile-contracts.mjs`
- `docs/report_profileroutes_run8a.md`
- `docs/report_profileroutes_run8b.md`
- `docs/report_profileroutes_run8c.md`

Key preserved contracts:
- profile schema gate (503)
- displayName/username validation rules
- profile update success/error payload shapes

### Run 9: Saved interfaces route extraction

Commits:
- `cc0c89a` chore(server): add savedInterfaces routes module (run9a)
- `45aa5b7` refactor(server): wire savedInterfaces routes module (run9b)
- `6fd8566` test(saved-interfaces): lock saved interfaces contract guards (run9c)

Artifacts:
- `src/server/src/routes/savedInterfacesRoutes.ts`
- `src/server/scripts/test-saved-interfaces-contracts.mjs`
- `docs/report_savedinterfaces_run9a.md`
- `docs/report_savedinterfaces_run9b.md`
- `docs/report_savedinterfaces_run9c.md`

Key preserved contracts:
- list/upsert/delete routes and payload shapes
- exact validation error strings
- exact 413 message `saved interface payload too large`
- iso/null timestamp mapping in list response

### Run 10: Payments route split (order-sensitive)

Commits:
- `dc21c5c` chore(server): add payments routes module (run10a)
- `b2af1ad` chore(server): add paymentsWebhookRoute module (run10b)
- `d218bd1` refactor(server): wire payments routes modules (run10c)
- `141c989` test(payments): lock payments contract guards (run10d)

Artifacts:
- `src/server/src/routes/paymentsRoutes.ts`
- `src/server/src/routes/paymentsWebhookRoute.ts`
- `src/server/scripts/test-rupiah-contracts.mjs`
- `src/server/scripts/test-payments-create-status-contracts.mjs`
- `src/server/scripts/test-payments-webhook-contracts.mjs`
- `src/server/scripts/test-payments-contracts.mjs`
- `docs/report_payments_run10a.md`
- `docs/report_payments_run10b.md`
- `docs/report_payments_run10c.md`
- `docs/report_payments_run10d.md`

Key preserved contracts:
- webhook remains pre-cors
- create/status/webhook status codes and response shapes
- pending status fallback with `midtrans_error` preserved
- topup apply call sites preserved

## 4. Contract Guards Added Across Runs

Current deterministic guard scripts in `src/server/scripts` relevant to runs 1-10:
- `test-requestflow-contracts.mjs`
- `test-jsonparsers-contracts.mjs`
- `test-cors-contracts.mjs`
- `test-startupgates-contracts.mjs`
- `test-health-contracts.mjs`
- `test-auth-me-contracts.mjs`
- `test-auth-google-contracts.mjs`
- `test-profile-contracts.mjs`
- `test-saved-interfaces-contracts.mjs`
- `test-rupiah-contracts.mjs`
- `test-payments-create-status-contracts.mjs`
- `test-payments-webhook-contracts.mjs`
- `test-payments-contracts.mjs`

These scripts lock brittle behavior where full infra e2e is expensive.

## 5. Invariants Preserved (Run1-Run10)

1. Middleware/order invariants:
- webhook registration remains before CORS
- saved-interfaces parser chain remains special and intact
- startup gates run before `listen`

2. Auth/session invariants:
- cookie contract preserved (`arnvoid_session`, options behavior)
- `/me` remains source-of-truth contract with user-null semantics

3. Saved-interfaces invariants:
- validation and 413 message parity preserved
- response shape and timestamps mapping preserved

4. Payments invariants:
- status code and response contracts preserved
- webhook always 200-response style behavior preserved
- topup apply call sites preserved (idempotency expectations unchanged)

5. LLM route extraction and prior parity fixes remain intact under modularized wiring.

## 6. Monolith Shrink Profile

- baseline run0 lock: 968 lines
- after run5: 892 lines (from prior phase report)
- after run8: 720 lines
- after run9: 605 lines
- after run10: 302 lines

Net from run0 baseline to run10: minus 666 lines.

## 7. Residual Risks and Watchpoints

1. SQL matcher brittleness in contract tests:
- fake pool matchers are intentionally narrow and can fail after benign SQL text refactors.

2. Branch-sensitive contracts:
- webhook finalization and pending-status midtrans fallback are easy to regress if handlers are restructured.

3. Env/config centralization effect:
- env config is startup-loaded; runtime `process.env` mutation is not reflected dynamically.

4. Log string coupling:
- some parity checks and forensic docs rely on stable log text; edits can create review churn.

## 8. Conclusion

Runs 1-10 achieved the intended modularization endgoal with parity-first execution discipline:
- small staged diffs
- per-run docs and commits
- deterministic contract guard expansion
- strict order-sensitive wiring preservation

Current backend shape is materially safer for further modularization, with monolith reduced to 302 lines and critical contracts locked by docs plus executable guards.
