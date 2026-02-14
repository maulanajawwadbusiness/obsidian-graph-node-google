# Run 15c Report: repo_xray Backend Map Refresh

Date: 2026-02-15
Scope: refresh `docs/repo_xray.md` for post-run14 backend architecture

## Exact Edits Made

1. Header and update notes
- changed top date to `2026-02-15`.
- added `Update Note: 2026-02-15` summarizing backend refactor runs 0-14:
  - monolith shell
  - bootstrap orchestration
  - depsBuilder seam
  - route split under `routes/*`
  - unified contract runner `npm run test:contracts`

2. Top source files section
- removed stale monolith ownership claim.
- added backend architecture files with measured line counts:
  - `src/server/src/routes/llmAnalyzeRoute.ts` (561)
  - `src/server/src/routes/paymentsRoutes.ts` (227)
  - `src/server/src/routes/authRoutes.ts` (218)
  - `src/server/src/routes/savedInterfacesRoutes.ts` (137)
  - `src/server/src/server/bootstrap.ts` (142)
  - `src/server/src/server/depsBuilder.ts` (120)

3. Auth flow map section
- updated backend file ownership:
  - `index.ts` imports monolith shell
  - monolith shell starts bootstrap
  - auth logic in `routes/authRoutes.ts`
  - middleware/helper seams in `auth/requireAuth.ts` and `server/cookies.ts`

4. Saved Interfaces backend references
- replaced monolith route ownership with `routes/savedInterfacesRoutes.ts`.
- added parser seam `server/jsonParsers.ts`.
- replaced stale payload-guard statement with test-locked mechanism:
  - `test:jsonparsers-contracts`
  - `test:saved-interfaces-contracts`

5. Backend API seams block
- replaced monolith endpoint list with current seam map:
  - monolith shell
  - bootstrap
  - depsBuilder
  - split route modules for auth/profile/saved-interfaces/payments/llm

6. Added backend order invariants block
- webhook pre-cors
- parsers pre-routes
- startup gates pre-listen
- order guard command: `npm run test:servermonolith-shell`

7. Payments and LLM endpoint sections
- added route ownership file paths:
  - payments: `paymentsRoutes.ts`, `paymentsWebhookRoute.ts`
  - llm: `llmAnalyzeRoute.ts`, `llmChatRoute.ts`, `llmPrefillRoute.ts`

## Non-Changes
- frontend AppShell and physics sections were not rewritten beyond existing content.
- no runtime code changed.
