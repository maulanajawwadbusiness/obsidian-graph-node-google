# Forensic Work Report: Backend LLM Refactor Sequence

Date: 2026-02-14
Branch: `wire-onboarding-screen-backend-refactoring`
Scope: backend LLM route extraction and post-extraction dedup, plus preceding header fix and branch operations performed in this execution cycle.

## 1. Executive Summary

Completed work followed the required safety sequence:
1. Fixed duplicate `X-Request-Id` header writes in analyze insufficient-balance branches.
2. Produced run-1 duplication map report.
3. Extracted LLM routes first (no dedup).
4. Deduped shared flow second, after extraction.

Core outcomes:
- LLM route logic moved out of monolith into `src/server/src/routes/*`.
- Shared runtime/request/audit/billing helpers added in `src/server/src/llm/*`.
- Build verification passed at each major refactor step.
- Required side reports were written for each major run.

## 2. Chronology and Commits

## 2.1 Priority-1 header fix

Commit:
- `651f03b`
- `fix(llm/analyze): avoid duplicate X-Request-Id header writes`

Changes:
- removed redundant repeated `res.setHeader("X-Request-Id", requestId)` calls in analyze `402` branches.
- added fix report: `docs/report_fix_x_request_id_analyze.md`.

## 2.2 Branch operation

Performed:
- created and switched to `wire-onboarding-screen-backend-refactoring`.
- pushed with upstream to origin.

Current tracking state:
- local branch tracks `origin/wire-onboarding-screen-backend-refactoring`.

## 2.3 Priority-2 mini-run 1 (scan/map only)

Commit:
- `baa67db`
- `docs(report): map llm duplication across analyze prefill chat (run1)`

Artifact:
- `docs/report_llm_duplication_map_run1.md`

## 2.4 Priority-2 mini-run 2 (route extraction only)

Commit:
- `5f2f40f`
- `refactor(llm): extract analyze/prefill/chat routes (no dedup)`

Artifacts:
- `docs/report_llm_route_extraction_run2.md`
- `src/server/src/routes/llmAnalyzeRoute.ts`
- `src/server/src/routes/llmPrefillRoute.ts`
- `src/server/src/routes/llmChatRoute.ts`
- `src/server/src/routes/llmRouteDeps.ts`
- rewired `src/server/src/serverMonolith.ts`

## 2.5 Priority-2 mini-run 3 (dedup after extraction)

Commit:
- `5cf67e8`
- `refactor(llm): dedup shared audit/billing/request flow`

Artifacts:
- `docs/report_llm_dedup_run3.md`
- `src/server/src/llm/requestFlow.ts`
- `src/server/src/llm/runtimeState.ts`
- `src/server/src/llm/auditState.ts`
- `src/server/src/llm/billingFlow.ts`
- updated extracted route modules and monolith wiring.

## 3. File-Level Change Inventory

## 3.1 New reports

- `docs/report_fix_x_request_id_analyze.md`
- `docs/report_llm_duplication_map_run1.md`
- `docs/report_llm_route_extraction_run2.md`
- `docs/report_llm_dedup_run3.md`

## 3.2 New backend modules

Route modules:
- `src/server/src/routes/llmAnalyzeRoute.ts`
- `src/server/src/routes/llmPrefillRoute.ts`
- `src/server/src/routes/llmChatRoute.ts`
- `src/server/src/routes/llmRouteDeps.ts`

LLM helper modules:
- `src/server/src/llm/requestFlow.ts`
- `src/server/src/llm/runtimeState.ts`
- `src/server/src/llm/auditState.ts`
- `src/server/src/llm/billingFlow.ts`

## 3.3 Updated existing files

- `src/server/src/serverMonolith.ts` (LLM routes rewired; shared helper ownership shifted)

## 4. Architecture State After Work

## 4.1 Monolith role

`src/server/src/serverMonolith.ts` is no longer carrying full LLM handler bodies.

Current line count:
- `src/server/src/serverMonolith.ts`: 968 lines

Current LLM registration points:
- imports at `src/server/src/serverMonolith.ts:20-22`
- register calls at:
  - `src/server/src/serverMonolith.ts:942` (`registerLlmAnalyzeRoute`)
  - `src/server/src/serverMonolith.ts:1055` (`registerLlmPrefillRoute`)
  - `src/server/src/serverMonolith.ts:1056` (`registerLlmChatRoute`)

## 4.2 Extracted route module sizes

- `src/server/src/routes/llmAnalyzeRoute.ts`: 560 lines
- `src/server/src/routes/llmPrefillRoute.ts`: 424 lines
- `src/server/src/routes/llmChatRoute.ts`: 431 lines

## 4.3 Shared helper ownership

Request flow:
- centralized in `src/server/src/llm/requestFlow.ts`
  - `sendApiError`
  - `mapLlmErrorToStatus`
  - `mapTerminationReason`
  - `getUsageFieldList`
  - `getPriceUsdPerM`
  - `logLlmRequest`

Runtime state:
- centralized in `src/server/src/llm/runtimeState.ts`
  - concurrency slots
  - request counters
  - periodic JSON metrics log

Audit defaults:
- centralized in `src/server/src/llm/auditState.ts`

Billing flow:
- centralized in `src/server/src/llm/billingFlow.ts`
  - fx/pricing estimate
  - precheck balance
  - charge usage
  - freepool ledger apply

## 5. Contract and Behavior Preservation Notes

Preservation intent was maintained:
- no route path changes for LLM endpoints.
- no planned status code changes.
- no planned response body shape changes.
- chat streaming structure kept (`req.on("close")`, finalize in `finally`, stream write/end flow preserved).

Header-specific notes:
- analyze duplicate `X-Request-Id` writes removed in priority-1 fix.
- no `res.append("X-Request-Id", ...)` introduced.
- current explicit header-write points in extracted routes:
  - analyze: `src/server/src/routes/llmAnalyzeRoute.ts:238`, `src/server/src/routes/llmAnalyzeRoute.ts:488`, `src/server/src/routes/llmAnalyzeRoute.ts:538`
  - prefill success: `src/server/src/routes/llmPrefillRoute.ts:400`
  - chat stream start: `src/server/src/routes/llmChatRoute.ts:281`

## 6. Verification Evidence

## 6.1 Compile verification

Executed:
- `npm run build` in `src/server`

Result:
- pass after mini-run 2 extraction.
- pass after mini-run 3 dedup.

## 6.2 Runtime verification limits observed earlier

When attempting local `npm run dev` previously in this environment, Cloud SQL connector timeout occurred (consistent with backend VPN/network sensitivity in docs). Refactor validation here was done via static build and code-path review, not full DB-backed runtime replay.

## 7. Duplication Reduction Snapshot

Measured route-file total:
- run 2 totals: 1453 lines (analyze 575, prefill 435, chat 443)
- run 3 totals: 1415 lines

Net reduction from run 2 to run 3 route bodies:
- approximately 38 lines directly removed from route modules, plus meaningful centralization of repeated logic into dedicated helpers.

## 8. Risks and Residual Gaps

1. Full runtime parity for every error branch remains dependent on DB-backed and provider-backed end-to-end tests, which were not fully executable from this shell.
2. Monolith is reduced for LLM concern but still above long-term target for full backend modularization (968 lines).
3. Header consistency across all endpoints remains intentional-parity, not global normalization, per locked task scope.

## 9. Current Git State

At report write time:
- branch: `wire-onboarding-screen-backend-refactoring`
- tracking: `origin/wire-onboarding-screen-backend-refactoring`
- branch is ahead of origin by 3 commits (`baa67db`, `5f2f40f`, `5cf67e8`) and requires push to publish latest refactor commits.

