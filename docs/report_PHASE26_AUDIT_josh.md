# Phase 2.6 Audit Report (Josh)

Date: 2026-02-21
Scope: Audit only for phase 2.6 micro-hardening claims A/B/C. No code changes made.

## Executive Summary

- A) Repair loop budgeting + payload shaping: PASS
- B) Determinism hardening (locale-independent ordering): PASS
- C) Mode seam hardening (single-source guard, no bypass): PASS

Gate verdict: PASS with residual risks noted below.

## A) Repair Loop Budgeting + Payload Shaping

Status: PASS

Evidence anchors:
- Split budgets are explicit:
  - `MAX_PARSE_REPAIR_ATTEMPTS = 1` at `src/server/src/llm/analyze/skeletonAnalyze.ts:38`
  - `MAX_SEMANTIC_REPAIR_ATTEMPTS = 2` at `src/server/src/llm/analyze/skeletonAnalyze.ts:39`
- Parse and semantic counters are independent:
  - `parseRepairsUsed` and `semanticRepairsUsed` at `src/server/src/llm/analyze/skeletonAnalyze.ts:245`, `src/server/src/llm/analyze/skeletonAnalyze.ts:246`
  - parse budget check at `src/server/src/llm/analyze/skeletonAnalyze.ts:262`
  - semantic budget check at `src/server/src/llm/analyze/skeletonAnalyze.ts:308`
- Prioritized + capped repair error list:
  - cap constant `MAX_REPAIR_ERRORS_INCLUDED = 20` at `src/server/src/llm/analyze/skeletonAnalyze.ts:40`
  - prioritization function `getValidationPriority(...)` at `src/server/src/llm/analyze/skeletonAnalyze.ts:48`
  - summarizer `summarizeValidationErrorsForRepair(...)` at `src/server/src/llm/analyze/skeletonAnalyze.ts:80`
  - truncation marker `+N more errors truncated` at `src/server/src/llm/analyze/skeletonAnalyze.ts:96`
  - summarized lines fed into repair prompt at `src/server/src/llm/analyze/skeletonAnalyze.ts:321`, `src/server/src/llm/analyze/skeletonAnalyze.ts:376`
- Deterministic excerpt head+tail under cap:
  - `buildDocumentExcerptHeadTail(...)` at `src/server/src/llm/analyze/skeletonPrompt.ts:48`
  - head+tail utility `trimWithHeadTail(...)` at `src/server/src/llm/analyze/skeletonPrompt.ts:31`
  - excerpt cap `repairDocumentExcerptMaxChars: 3000` at `src/server/src/llm/analyze/skeletonPrompt.ts:16`

Behavior proof tests:
- parse retry cap = 1: `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:94`
- parse retry does not consume semantic budget: `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:109`
- summarized errors capped + prioritized + truncated marker: `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:126`, `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:127`, `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:129`
- deterministic excerpt head+tail and cap: `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs:31`, `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs:32`, `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs:34`

## B) Determinism Hardening (Locale-Independent Ordering)

Status: PASS

Evidence anchors:
- Locale-independent comparator introduced:
  - `compareCodeUnit(...)` at `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:21`
- Node and edge ordering use code-unit compare:
  - node tie-break by id at `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:29`
  - edge tie-breaks by from/to/type/rationale at `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:34`, `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:35`, `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:36`, `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:37`
  - final stable key compare at `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:40`
- Sort application points:
  - `sortedNodes` at `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:47`
  - `sortedEdges` at `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:48`

Verification:
- No `localeCompare` usage in this adapter file (checked via grep)
- Unicode determinism test path exists and passes:
  - `src/server/scripts/test-knowledge-skeleton-adapter-contracts.mjs` (unicode deterministic payload assertions)

## C) Mode Seam Hardening (Single Source + 3 Guards + No Direct Bypass)

Status: PASS

Evidence anchors:
- Three guards defined, default false:
  - `ENABLE_SKELETON_ANALYZE_MODE` at `src/ai/analyzeMode.ts:3`
  - `ACK_PHASE3_SKELETON_WIRING_COMPLETE` at `src/ai/analyzeMode.ts:4`
  - `SKELETON_TOPOLOGY_WIRING_ENABLED` at `src/ai/analyzeMode.ts:5`
- Centralized policy helpers:
  - `isSkeletonAnalyzeModeAllowed(...)` at `src/ai/analyzeMode.ts:19`
  - `resolveAnalyzeRequestModeForFlags(...)` at `src/ai/analyzeMode.ts:27`
  - `resolveAnalyzeRequestMode(...)` at `src/ai/analyzeMode.ts:33`
- Activation requires all 3 guards:
  - boolean conjunction in `isSkeletonAnalyzeModeAllowed(...)` at `src/ai/analyzeMode.ts:21`
- `skeletonAnalyzer` no longer hardcodes `mode: "skeleton_v1"`:
  - imports resolver/guard at `src/ai/skeletonAnalyzer.ts:4`
  - reads resolver at `src/ai/skeletonAnalyzer.ts:101`
  - blocks with `mode_guard_blocked` if not allowed at `src/ai/skeletonAnalyzer.ts:102`, `src/ai/skeletonAnalyzer.ts:105`
  - sends `mode: requestMode` at `src/ai/skeletonAnalyzer.ts:115`
- Primary app path still goes through resolver:
  - `paperAnalyzer` uses `resolveAnalyzeRequestMode()` at `src/ai/paperAnalyzer.ts:359`
  - sends `mode: requestMode` at `src/ai/paperAnalyzer.ts:394`

Behavior proof tests:
- mode-guard contract test confirms no hardcoded bypass and presence of centralized guard hooks:
  - `src/server/scripts/test-skeleton-mode-guard-contracts.mjs`
- script is wired into contract suite:
  - `src/server/package.json:36`
  - `src/server/scripts/run-contract-suite.mjs:25`

## New Risks Discovered

- Medium: Effective invalid JSON context in semantic repair is tighter than declared max.
  - `buildSkeletonRepairInput` allows 8000 chars (`src/server/src/llm/analyze/skeletonPrompt.ts:104`), but caller passes `toDebugPreview(...)` capped by raw preview limit 2000 (`src/server/src/llm/analyze/skeletonAnalyze.ts:173`, `src/server/src/llm/analyze/skeletonAnalyze.ts:321`).
  - Impact: weaker repair context on complex failures.

- Medium: Total OpenRouter attempts can increase vs prior behavior.
  - With independent budgets, worst-case loop can run parse + semantic sequences (bounded, but more calls than a single shared budget).
  - Anchors: `src/server/src/llm/analyze/skeletonAnalyze.ts:245`, `src/server/src/llm/analyze/skeletonAnalyze.ts:246`, `src/server/src/llm/analyze/skeletonAnalyze.ts:262`, `src/server/src/llm/analyze/skeletonAnalyze.ts:308`.

- Low: Guarding is frontend-centralized; backend mode remains callable by request payload.
  - Server still accepts `mode: "skeleton_v1"` (`src/server/src/llm/validate.ts`, `src/server/src/routes/llmAnalyzeRoute.ts:395`).
  - This is expected for staged rollout but worth keeping explicit in phase 3 threat model.

- Low: Locale-sensitive sorting still exists in unrelated modules.
  - `localeCompare` appears elsewhere in repo (outside skeleton adapter path). Not a phase 2.6 claim failure, but watch if phase 3 integrates those paths.

## Phase 3 Watchlist Update

1. Repair loop budget seam: `src/server/src/llm/analyze/skeletonAnalyze.ts:245`.
2. Error summarization seam (priority and truncation policy): `src/server/src/llm/analyze/skeletonAnalyze.ts:80`.
3. Prompt context budget seam (invalid JSON vs raw preview cap interaction): `src/server/src/llm/analyze/skeletonPrompt.ts:104`, `src/server/src/llm/analyze/skeletonAnalyze.ts:173`.
4. Deterministic skeleton ordering seam: `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:32`.
5. Frontend mode activation seam: `src/ai/analyzeMode.ts:19`.
6. Skeleton frontend guard seam: `src/ai/skeletonAnalyzer.ts:102`.
7. Backend mode branch seam for topology handoff: `src/server/src/routes/llmAnalyzeRoute.ts:395`, `src/server/src/routes/llmAnalyzeRoute.ts:731`.

## Verification Commands Run

- `npm run test:knowledge-skeleton-analyze-contracts` (pass)
- `npm run test:knowledge-skeleton-repair-budget-contracts` (pass)
- `npm run test:knowledge-skeleton-adapter-contracts` (pass)
- `npm run test:skeleton-mode-guard-contracts` (pass)
- `npm run test:knowledge-skeleton-contracts` (pass)
- `npm run test:knowledge-skeleton-prompt-contracts` (pass)
