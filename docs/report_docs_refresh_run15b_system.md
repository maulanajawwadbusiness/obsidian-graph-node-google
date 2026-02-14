# Run 15b Report: system.md Backend Refresh

Date: 2026-02-15
Scope: backend-relevant sections only in `docs/system.md`

## Exact Edits Made

1. Saved-interfaces payload guard section updated
- replaced stale monolith constant ownership line with current mechanism:
  - parser seam: `src/server/src/server/jsonParsers.ts`
  - guard command: `npm run test:jsonparsers-contracts`
  - pinned exact user-facing 413 body:
    - `{ ok: false, error: "saved interface payload too large" }`

2. Added `## Backend Runtime Architecture` section
- shell entry: `src/server/src/serverMonolith.ts`
- orchestration owner: `src/server/src/server/bootstrap.ts`
- route module ownership under `src/server/src/routes/*.ts`
- deps assembly seam: `src/server/src/server/depsBuilder.ts`
- server seams listed:
  - `envConfig.ts`, `jsonParsers.ts`, `corsConfig.ts`, `startupGates.ts`, `cookies.ts`

3. LLM endpoints section updated
- added route file paths:
  - `llmAnalyzeRoute.ts`, `llmChatRoute.ts`, `llmPrefillRoute.ts`
- added shared request flow seam path:
  - `src/server/src/llm/requestFlow.ts`
- added contract guard command:
  - `npm run test:requestflow-contracts`
- added note that retry-after and API error header/order behavior are locked in requestFlow + tests.

4. Payments section updated
- added route file paths:
  - `src/server/src/routes/paymentsRoutes.ts`
  - `src/server/src/routes/paymentsWebhookRoute.ts`
- added helper seam path:
  - `src/server/src/payments/midtransUtils.ts`

5. Auth section updated
- replaced stale monolith route ownership with current runtime chain:
  - `index.ts` -> monolith shell -> bootstrap
- added current auth route location:
  - `src/server/src/routes/authRoutes.ts`
- added extracted auth helper seams:
  - `src/server/src/auth/googleToken.ts`
  - `src/server/src/auth/requireAuth.ts`

6. Profile update contract path updated
- from monolith path to:
  - `src/server/src/routes/profileRoutes.ts`
- request/response contract wording kept same.

7. Added `## Backend Contract Tests` subsection
- single command:
  - run in `src/server`: `npm run test:contracts`
- coverage summary added for parsers/cors/startup/auth/profile/saved-interfaces/payments/depsbuilder/monolith shell.

## Non-Changes
- Frontend sections were not modified.
- No runtime files changed.
