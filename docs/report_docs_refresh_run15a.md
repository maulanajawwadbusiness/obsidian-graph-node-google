# Run 15a Report: Docs Drift Scan Checklist

Date: 2026-02-15
Scope: drift checklist only, no doc edits in this run

## Files Scanned
- `docs/system.md`
- `docs/repo_xray.md`
- `AGENTS.md`

## Drift Checklist

### A. docs/system.md drift
1. Backend ownership is stale:
- currently says route logic lives in `src/server/src/serverMonolith.ts`.
- now true shape is:
  - shell entry: `src/server/src/serverMonolith.ts`
  - orchestration/order: `src/server/src/server/bootstrap.ts`
  - route modules: `src/server/src/routes/*.ts`
  - deps assembly: `src/server/src/server/depsBuilder.ts`
  - seams: `envConfig.ts`, `jsonParsers.ts`, `corsConfig.ts`, `startupGates.ts`, `cookies.ts`

2. Auth paths are stale:
- `/auth/google`, `/me`, `/auth/logout` still described under monolith ownership.
- should point to `src/server/src/routes/authRoutes.ts` and helpers:
  - `src/server/src/auth/googleToken.ts`
  - `src/server/src/auth/requireAuth.ts`

3. Profile route location is stale:
- currently references monolith.
- should reference `src/server/src/routes/profileRoutes.ts`.

4. Saved interfaces payload guard statement is stale:
- currently references monolith constant for payload guard.
- should describe current mechanism:
  - parser seam in `src/server/src/server/jsonParsers.ts`
  - saved-interfaces 413 mapping locked by `test:jsonparsers-contracts`

5. Payments backend location is incomplete:
- should include route files:
  - `src/server/src/routes/paymentsRoutes.ts`
  - `src/server/src/routes/paymentsWebhookRoute.ts`
- should mention helpers:
  - `src/server/src/payments/midtransUtils.ts`

6. LLM backend section should mention route modules and requestFlow seam:
- `src/server/src/routes/llmAnalyzeRoute.ts`
- `src/server/src/routes/llmPrefillRoute.ts`
- `src/server/src/routes/llmChatRoute.ts`
- `src/server/src/llm/requestFlow.ts`
- guard: `test:requestflow-contracts`

7. Missing backend contract test subsection:
- should mention single command `npm run test:contracts` in `src/server`
- should summarize coverage at high level.

### B. docs/repo_xray.md drift
1. Header is stale:
- no update note for post-run14 backend refactor.

2. Top source files section is stale:
- incorrectly says `serverMonolith.ts` holds auth/payments/llm logic.
- should reflect shell + bootstrap + depsBuilder + route modules.

3. Auth flow map stale file ownership:
- should be:
  - `index.ts` imports monolith shell
  - monolith shell calls `startServer` in bootstrap
  - auth routes in `routes/authRoutes.ts`
  - session middleware in `auth/requireAuth.ts`
  - cookie utils in `server/cookies.ts`

4. Saved interfaces backend references are stale:
- should reference `routes/savedInterfacesRoutes.ts`
- should replace monolith payload guard mention with parser seam + tests.

5. Missing short backend order invariants block:
- webhook pre-cors
- parsers pre-routes
- startup gates pre-listen
- order guard via `test:servermonolith-shell`.

### C. AGENTS.md drift
1. Missing backend mental model for post-run14 shape:
- monolith shell, bootstrap order owner, depsBuilder wiring hub, route modules, server seams.

2. Missing practical "add backend route" workflow:
- add route module
- extend depsBuilder
- register in bootstrap with order awareness
- add contract script and include in `test:contracts`
- update shell guard if order-sensitive.

3. Missing explicit windows-safe test command path:
- `npm run build`
- `npm run test:contracts`
- note runner uses npm command with shell compatibility.

4. Missing docs discipline update:
- architecture changes must update both `docs/system.md` and `docs/repo_xray.md`.

## Execution Plan for Run15b/15c/15d
1. Update backend-only sections in `docs/system.md`.
2. Refresh backend map and update notes in `docs/repo_xray.md`.
3. Add backend onboarding section in `AGENTS.md` with route-add checklist and test commands.

## Goal Lock
After run15, docs must match current file paths, ownership seams, and contract test commands from post-run14 code.
