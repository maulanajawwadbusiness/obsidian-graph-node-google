# Run 2 Report: LLM Route Extraction (No Dedup)

Date: 2026-02-14
Scope: route extraction only
Status: completed, build passing

## 1. What moved

Three LLM route handlers were extracted from `src/server/src/serverMonolith.ts` into dedicated route modules without deduping internal flow logic:

- `src/server/src/routes/llmAnalyzeRoute.ts`
  - export: `registerLlmAnalyzeRoute(...)` at line `20`
- `src/server/src/routes/llmPrefillRoute.ts`
  - export: `registerLlmPrefillRoute(...)` at line `15`
- `src/server/src/routes/llmChatRoute.ts`
  - export: `registerLlmChatRoute(...)` at line `16`

Shared route dependency types added:

- `src/server/src/routes/llmRouteDeps.ts`

## 2. Monolith wiring after extraction

`src/server/src/serverMonolith.ts` now wires LLM routes via register functions and dependency objects:

- import route register functions:
  - `src/server/src/serverMonolith.ts:25`
  - `src/server/src/serverMonolith.ts:26`
  - `src/server/src/serverMonolith.ts:27`

- common deps object:
  - `src/server/src/serverMonolith.ts:1070`

- endpoint deps objects:
  - `llmAnalyzeRouteDeps`: `src/server/src/serverMonolith.ts:1094`
  - `llmPrefillRouteDeps`: `src/server/src/serverMonolith.ts:1099`
  - `llmChatRouteDeps`: `src/server/src/serverMonolith.ts:1103`

- registration calls:
  - analyze: `src/server/src/serverMonolith.ts:1113`
  - prefill: `src/server/src/serverMonolith.ts:1226`
  - chat: `src/server/src/serverMonolith.ts:1227`

Route paths remain unchanged:
- `POST /api/llm/paper-analyze`
- `POST /api/llm/prefill`
- `POST /api/llm/chat`

## 3. Parity notes

This run intentionally did not dedup business logic inside the handlers.
The extracted handlers keep the same flow and branching behavior as monolith route bodies, with only dependency-prefix substitutions (`deps.*`) and counter hooks.

Preserved in route logic:
- status codes and body shapes
- audit write pattern
- request logs
- concurrency gate behavior
- pricing and charging flow
- chat streaming lifecycle (`req.on("close")`, stream try path, finalize-in-finally)

Header behavior policy preserved:
- no normalization changes introduced in this run.
- analyze keeps current explicit `X-Request-Id` behavior from previous fix.
- prefill/chat branch header behavior remains as before extraction.

## 4. Static verification

Build command:
```powershell
npm run build
```
Run in: `src/server`

Result:
- pass (`tsc` exit code 0).

## 5. Intentional non-goals for run 2

- no LLM dedup helpers yet
- no auth/payments/saved-interface route changes
- no runtime behavior redesign

