# Run 12d Report: depsBuilder Contract Guard

Date: 2026-02-14
Scope: add deterministic deps builder shape guard

## Added
- script: `src/server/scripts/test-depsbuilder-contracts.mjs`
- npm script: `test:depsbuilder-contracts` in `src/server/package.json`

## What the guard locks
1. `buildRouteDeps(...)` returns all expected top-level keys:
   - `health`, `auth`, `profile`, `savedInterfaces`, `payments`, `paymentsWebhook`, `llmAnalyze`, `llmPrefill`, `llmChat`
2. Each route deps object exposes required callable seams (minimal checks only).
3. Config pass-through wiring is preserved for critical values:
   - auth cookie name
   - auth google client id
4. Webhook signature dep is correctly closed over config server key.

## What the guard intentionally does not lock
1. Exact function implementations in route handlers.
2. Full runtime behavior of auth/payments/llm routes (covered by existing route contract suites).
3. Log strings and non-essential dep object internals.

## Safety
- test is deterministic, no network, no real db.
- this run adds guard coverage only; runtime route behavior remains unchanged.
