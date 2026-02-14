# Forensic Report: Server Phase 1 Steps 1-6

Date: 2026-02-14
Branch: wire-onboarding-screen-backend-refactoring
Scope: consolidated forensic report for Phase 1 work steps 1-6
Authoring mode: post-facto reconstruction from git history, seam reports, and current code state

## 1. Executive Summary

Phase 1 steps 1-6 were completed as ordered seam extractions with guardrails:
1. Step 1: contract baseline lock (run0)
2. Step 2: env/constants seam (run1a-1c)
3. Step 3: cookie utilities seam (run2a-2c)
4. Step 4: json parser seam (run3a-3c)
5. Step 5: cors seam (run4a-4c)
6. Step 6: startup gates seam (run5a-5c)

All mini-runs followed the same protocol:
- small diff
- docs side report
- build verification (`npm run build` in `src/server`)
- commit

Key outcome:
- `src/server/src/serverMonolith.ts` reduced from 968 lines (baseline step) to 892 lines after step 6.
- brittle invariants were preserved by deterministic contract guards for requestflow, json parsers, cors, and startup gates.

## 2. Baseline and End State

Baseline at step 1 (run0 lock):
- monolith lines: 968
- baseline contract doc: `docs/report_servermonolith_contract_baseline_run0.md`

End state after step 6:
- monolith lines: 892
- net reduction from step-1 baseline: 76 lines
- seam modules added under `src/server/src/server/*`
- contract tests added under `src/server/scripts/*`

## 3. Step-by-Step Forensic Timeline

## Step 1: Contract baseline lock (run0)

Intent:
- freeze parity truth before further extraction

Commit:
- `e83b9cf` `docs(server): lock serverMonolith contract baseline (run0)`

Artifact:
- `docs/report_servermonolith_contract_baseline_run0.md`

Locked truths:
- route inventory and auth/payment/llm/saved-interfaces contracts
- middleware/parser/cors ordering invariants
- startup gate ordering and failure behavior

## Step 2: Env/constants seam (run1)

### run1a: module add only
Commit:
- `48423de` `chore(server): add envConfig module (run1a)`

Added:
- `src/server/src/server/envConfig.ts`
- `docs/report_envconfig_run1a.md`

### run1b: monolith wiring
Commit:
- `f882515` `refactor(server): wire serverMonolith to envConfig (run1b)`

Changed:
- `src/server/src/serverMonolith.ts`
- `docs/report_envconfig_run1b.md`

Seam moved:
- port/cookie/session/saved-interface limits/cors allowlist/prod detection/dev bypass/openrouter allow policy

### run1c: parity scan
Commit:
- `14ae2dd` `docs(server): add envConfig parity scan (run1c)`

Added:
- `docs/report_envconfig_run1c.md`

Finding:
- remaining `process.env` in monolith limited to non-target Midtrans and Google auth keys.

## Step 3: Cookie seam (run2)

### run2a: module add only
Commit:
- `ea42082` `chore(server): add cookies utilities module (run2a)`

Added:
- `src/server/src/server/cookies.ts`
- `docs/report_cookies_run2a.md`

### run2b: callsite wiring
Commit:
- `648d69f` `refactor(server): move cookie helpers to cookies.ts (run2b)`

Changed:
- `src/server/src/serverMonolith.ts`
- `docs/report_cookies_run2b.md`

Rewired callsites:
- `requireAuth`
- `/auth/google`
- `/me`
- `/auth/logout`

### run2c: parity scan
Commit:
- `a627848` `docs(server): add cookie seam parity scan (run2c)`

Added:
- `docs/report_cookies_run2c.md`

Finding:
- no remaining direct `req.headers.cookie` parse or direct `res.cookie`/`res.clearCookie` in monolith.

State after step 3:
- monolith lines: 931

## Step 4: JSON parser seam (run3)

### run3a: module add only
Commit:
- `624e5bf` `chore(server): add jsonParsers module (run3a)`

Added:
- `src/server/src/server/jsonParsers.ts`
- `docs/report_jsonparsers_run3a.md`

### run3b: monolith wiring
Commit:
- `1bfcbe1` `refactor(server): wire serverMonolith to jsonParsers seam (run3b)`

Changed:
- `src/server/src/serverMonolith.ts`
- `docs/report_jsonparsers_run3b.md`

Preserved invariants:
- saved-interfaces parser mounted first
- global parser skip-gate for `/api/saved-interfaces`
- saved-only `entity.too.large` -> `413 { ok:false, error:"saved interface payload too large" }`

### run3c: deterministic contract guard
Commit:
- `cf0ed8f` `test(server): lock json parser contract guards (run3c)`

Added:
- `src/server/scripts/test-jsonparsers-contracts.mjs`
- `docs/report_jsonparsers_run3c.md`
- package script `test:jsonparsers-contracts`

Guard coverage:
- oversized payload mapping is custom only on saved-interfaces
- custom message does not leak to non-saved routes

State after step 4:
- monolith lines: 919

## Step 5: CORS seam (run4)

### run4a: module add only
Commit:
- `838804c` `chore(server): add corsConfig module (run4a)`

Added:
- `src/server/src/server/corsConfig.ts`
- `docs/report_cors_run4a.md`

Note:
- one TS typing mismatch on initial implementation was fixed without behavior changes.

### run4b: monolith wiring
Commit:
- `383533f` `refactor(server): wire serverMonolith to cors seam (run4b)`

Changed:
- `src/server/src/serverMonolith.ts`
- `docs/report_cors_run4b.md`

Preserved invariants:
- webhook route remains before CORS middleware and preflight
- origin callback behavior and strings preserved
- credentials/methods/allowedHeaders preserved

### run4c: deterministic contract guard
Commit:
- `82bdc43` `test(server): lock cors contract guards (run4c)`

Added:
- `src/server/scripts/test-cors-contracts.mjs`
- `docs/report_cors_run4c.md`
- package script `test:cors-contracts`

Guard coverage:
- allowed origin headers
- blocked origin non-2xx and no allow-origin header
- preflight contract (204 or 200 accepted)

State after step 5:
- monolith lines: 903

## Step 6: Startup gates seam (run5)

### run5a: module add only
Commit:
- `621dc9d` `chore(server): add startupGates module (run5a)`

Added:
- `src/server/src/server/startupGates.ts`
- `docs/report_startupgates_run5a.md`

### run5b: monolith wiring
Commit:
- `bca76b2` `refactor(server): wire serverMonolith to startupGates seam (run5b)`

Changed:
- `src/server/src/serverMonolith.ts`
- `docs/report_startupgates_run5b.md`

Preserved invariants:
- startup order stays `assertAuthSchemaReady -> detectProfileColumnsAvailability -> listen`
- fatal catch behavior unchanged (`console.error` + `process.exit(1)`)
- `profileColumnsAvailable` still assigned before listen and used by auth/me/profile routes

### run5c: deterministic contract guard
Commit:
- `ba70c75` `test(server): lock startup gates contract guards (run5c)`

Added:
- `src/server/scripts/test-startupgates-contracts.mjs`
- `docs/report_startupgates_run5c.md`
- package script `test:startupgates-contracts`

Guard coverage:
- startup call order
- return shape `{ schema, profileColumnsAvailable }`
- auth-schema log order

Final state after step 6:
- monolith lines: 892

## 4. Validation Evidence

Build gate:
- `npm run build` executed and passed after each mini-run from run1a through run5c.

Deterministic guards now present:
- `test:requestflow-contracts`
- `test:jsonparsers-contracts`
- `test:cors-contracts`
- `test:startupgates-contracts`

These cover the most brittle parity seams where runtime e2e with full infra is expensive.

## 5. New Files Added Across Steps 1-6

Docs:
- `docs/report_servermonolith_contract_baseline_run0.md`
- `docs/report_envconfig_run1a.md`
- `docs/report_envconfig_run1b.md`
- `docs/report_envconfig_run1c.md`
- `docs/report_cookies_run2a.md`
- `docs/report_cookies_run2b.md`
- `docs/report_cookies_run2c.md`
- `docs/report_jsonparsers_run3a.md`
- `docs/report_jsonparsers_run3b.md`
- `docs/report_jsonparsers_run3c.md`
- `docs/report_cors_run4a.md`
- `docs/report_cors_run4b.md`
- `docs/report_cors_run4c.md`
- `docs/report_startupgates_run5a.md`
- `docs/report_startupgates_run5b.md`
- `docs/report_startupgates_run5c.md`

Server seam modules:
- `src/server/src/server/envConfig.ts`
- `src/server/src/server/cookies.ts`
- `src/server/src/server/jsonParsers.ts`
- `src/server/src/server/corsConfig.ts`
- `src/server/src/server/startupGates.ts`

Contract scripts:
- `src/server/scripts/test-requestflow-contracts.mjs`
- `src/server/scripts/test-jsonparsers-contracts.mjs`
- `src/server/scripts/test-cors-contracts.mjs`
- `src/server/scripts/test-startupgates-contracts.mjs`

## 6. Residual Risks and Watchpoints

1. Runtime env mutability:
- env values used via `loadServerEnvConfig()` are now captured at startup; runtime mutation of process.env is no longer reflected dynamically.

2. Path predicate sensitivity:
- json parser custom 413 mapping is tied to `req.path.startsWith("/api/saved-interfaces")`; changing predicate semantics later can shift behavior.

3. CORS blocked response status variability:
- blocked-origin exact status may vary by Express error handling path; contract guard intentionally checks invariant-level behavior.

4. Startup log-format sensitivity:
- startup gate logs are now centralized in `startupGates.ts`; string edits there affect parity globally.

## 7. Conclusion

Phase 1 steps 1-6 achieved intended modularization seams without contract regressions in targeted areas, and added deterministic contract guards for brittle behavior.

Current monolith size is reduced to 892 lines with preserved startup, parser, cors, auth cookie, and route behavior contracts as defined by run0 baseline.
