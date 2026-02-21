# Phase 2.5 Hardening Audit (Josh)

Date: 2026-02-21
Scope: Verify hardening fixes in code (not docs), detect new risks, and assess phase-3 readiness. No code changes applied.

## Executive Summary (8-Item Gate)

1. Schema strictness: PASS
2. OpenRouter parse_error repair: PASS (with caveat)
3. Prompt edge-cap alignment: PASS
4. Repair payload caps: PARTIAL
5. Actionable orphan ids: PASS
6. Duplicate-edge policy + determinism: PARTIAL
7. Expanded harness negatives: PASS
8. Mode seam guard: PARTIAL

Overall gate verdict: PARTIAL PASS. Core hardening landed, but there are remaining holes that can affect phase-3 quality and safety if not handled during wiring.

## Verification Matrix

| Item # | Status | Evidence Anchors | Notes |
|---|---|---|---|
| 1 | PASS | `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:186`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:233`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:259`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:316`, `src/server/scripts/test-knowledge-skeleton-contracts.mjs:70` | Unknown fields are now rejected at root/node/edge with `unknown_property`. Runtime strictness now matches declared contract intent. |
| 2 | PASS | `src/server/src/llm/analyze/skeletonAnalyze.ts:58`, `src/server/src/llm/analyze/skeletonAnalyze.ts:111`, `src/server/src/llm/analyze/skeletonAnalyze.ts:193`, `src/server/src/llm/analyze/skeletonAnalyze.ts:203`, `src/server/src/llm/analyze/skeletonAnalyze.ts:217`, `src/server/src/llm/analyze/skeletonPrompt.ts:118`, `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:70`, `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:82` | Parse failures now route through parse-repair prompts and retry cap. Caveat: parse and semantic repairs share one attempt budget (`MAX_REPAIR_ATTEMPTS`), so repeated parse failures can consume semantic correction budget. |
| 3 | PASS | `src/server/src/llm/analyze/skeletonPrompt.ts:74`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:127`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:419`, `src/server/scripts/test-knowledge-skeleton-prompt-contracts.mjs:21` | Prompt now explicitly states the same hard edge cap rule enforced by semantic validation. |
| 4 | PARTIAL | `src/server/src/llm/analyze/skeletonPrompt.ts:13`, `src/server/src/llm/analyze/skeletonPrompt.ts:31`, `src/server/src/llm/analyze/skeletonPrompt.ts:84`, `src/server/src/llm/analyze/skeletonPrompt.ts:100`, `src/server/src/llm/analyze/skeletonPrompt.ts:125`, `src/server/src/llm/analyze/skeletonAnalyze.ts:131`, `src/server/src/llm/analyze/skeletonAnalyze.ts:134`, `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs:33` | Caps are implemented and tested. Remaining hole: validation error list in repair prompt is not independently capped; also 3000-char doc excerpt cap may be safe for budget but can reduce semantic fidelity for long papers (phase-3 quality risk). |
| 5 | PASS | `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:57`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:478`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:481`, `src/server/src/llm/analyze/skeletonAnalyze.ts:40`, `src/server/scripts/test-knowledge-skeleton-contracts.mjs:141`, `src/server/scripts/test-knowledge-skeleton-prompt-contracts.mjs:34` | Orphan errors now include `details.orphan_ids`, and repair formatting carries details forward. This is materially more actionable. |
| 6 | PARTIAL | `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:451`, `src/server/src/llm/analyze/skeletonPrompt.ts:75`, `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:26`, `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:31`, `src/server/scripts/test-knowledge-skeleton-contracts.mjs:153`, `src/server/scripts/test-knowledge-skeleton-adapter-contracts.mjs:80` | Duplicate semantic edges are now blocked (`from,to,type`) and prompt aligns. Determinism improved, but comparator still uses `localeCompare` on rationale for deepest tie; cross-runtime locale behavior can differ for non-ASCII, and deterministic assumptions still rely on prior validation. |
| 7 | PASS | `src/server/scripts/test-knowledge-skeleton-contracts.mjs:70`, `src/server/scripts/test-knowledge-skeleton-contracts.mjs:111`, `src/server/scripts/test-knowledge-skeleton-contracts.mjs:141`, `src/server/scripts/test-knowledge-skeleton-contracts.mjs:160`, `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs:84`, `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs:43`, `src/server/scripts/run-contract-suite.mjs:23`, `src/server/package.json:33` | Negative/boundary coverage expanded and wired into `test:contracts` (unknown properties, cap boundary, orphan details, duplicates, unicode/whitespace, parse repair, repair budgets). |
| 8 | PARTIAL | `src/ai/analyzeMode.ts:3`, `src/ai/analyzeMode.ts:4`, `src/ai/analyzeMode.ts:6`, `src/ai/analyzeMode.ts:11`, `src/ai/paperAnalyzer.ts:359`, `src/ai/paperAnalyzer.ts:394`, `src/ai/skeletonAnalyzer.ts:105`, `src/server/src/llm/validate.ts:84` | Central guard exists and blocks normal app flow by default. Hole: `src/ai/skeletonAnalyzer.ts` still hardcodes `mode: "skeleton_v1"`; currently unused, but it is a bypass path if accidentally wired. Server continues to accept `skeleton_v1` from any caller. |

## New Risks Discovered

- High: Long-document context compression risk.
  - `buildSkeletonAnalyzeInput` now caps document excerpt at 3000 chars (`src/server/src/llm/analyze/skeletonPrompt.ts:84`). This protects budget but can push outputs toward mechanical summaries for long papers.
- Medium: Shared retry budget across parse and semantic repairs.
  - A sequence of parse failures can consume all retries before semantic violations are corrected (`src/server/src/llm/analyze/skeletonAnalyze.ts:193`, `src/server/src/llm/analyze/skeletonAnalyze.ts:244`).
- Medium: Guard bypass surface still exists.
  - `src/ai/skeletonAnalyzer.ts` can request skeleton mode directly (`src/ai/skeletonAnalyzer.ts:105`) without going through `resolveAnalyzeRequestMode`.
- Low: Latent locale-sensitive ordering variance.
  - Deep tie-break uses `localeCompare` on rationale (`src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:31`), which can vary across environments for non-ASCII text.
- Medium: Phase-3 contract mismatch still unresolved by design.
  - `paperAnalyzer` still parses classic payload (`main_points`/`links`) (`src/ai/paperAnalyzer.ts:488`, `src/ai/paperAnalyzer.ts:497`), so turning on skeleton mode before phase-3 wiring will still break this path.

## Repair Loop Deadlock/Oscillation Assessment

- Hard deadlock: Not observed in current logic. Loop is bounded by `MAX_REPAIR_ATTEMPTS=2` (`src/server/src/llm/analyze/skeletonAnalyze.ts:38`).
- Oscillation potential: Still possible in model behavior (e.g., fixes orphaning but re-breaks edge cap or duplicate-edge), but bounded by attempt cap.
- Actionability quality: Improved.
  - Errors now include path + code + message + serialized details (`src/server/src/llm/analyze/skeletonAnalyze.ts:40`), and orphan ids are explicit (`src/server/src/llm/analyze/knowledgeSkeletonV1.ts:481`).
- Truncation usefulness: Mixed.
  - Safer token budget; reduced context may lower repair quality on long inputs.

## Determinism Check

- Positive:
  - Node order deterministic by pressure desc then id asc (`src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:21`).
  - Edge order deterministic by weight/from/to/type/(rationale) (`src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:26`).
  - Duplicate semantic edges now rejected (`src/server/src/llm/analyze/knowledgeSkeletonV1.ts:451`), reducing ambiguous tie scenarios.
- Residual:
  - Comparator uses locale-aware string comparison on rationale (`src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:31`).
  - Set/Map iteration in validation is deterministic for a fixed input insertion order; no randomness detected.
  - No random/time-based ordering found in skeleton adapter or validator.

## Classic Flow Regression Check

- Default app path remains classic.
  - `resolveAnalyzeRequestMode()` returns classic unless both flags are true (`src/ai/analyzeMode.ts:6`).
  - `paperAnalyzer` sends `mode: requestMode` (`src/ai/paperAnalyzer.ts:394`).
- Backend classic flow branch remains intact and unchanged in contract shape (`src/server/src/routes/llmAnalyzeRoute.ts:730`, `src/server/src/routes/llmAnalyzeRoute.ts:733`).
- No direct classic regression was observed in this audit pass.

## Phase 3 Watchlist (Exact Seams)

1. Frontend mode gate seam: `src/ai/analyzeMode.ts:6`.
2. Frontend request/parse seam (classic payload assumption): `src/ai/paperAnalyzer.ts:394`, `src/ai/paperAnalyzer.ts:488`.
3. Potential bypass seam to avoid accidental wiring: `src/ai/skeletonAnalyzer.ts:105`.
4. Backend mode branch contract seam: `src/server/src/routes/llmAnalyzeRoute.ts:395`, `src/server/src/routes/llmAnalyzeRoute.ts:731`.
5. Repair-loop orchestration seam: `src/server/src/llm/analyze/skeletonAnalyze.ts:193`, `src/server/src/llm/analyze/skeletonAnalyze.ts:244`.
6. Adapter deterministic ordering seam: `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:26`.
7. Topology mutation seam for phase-3 handoff: `src/graph/topologyControl.ts:203`.

## Verification Commands Run

- `npm run test:knowledge-skeleton-contracts` (pass)
- `npm run test:knowledge-skeleton-analyze-contracts` (pass)
- `npm run test:knowledge-skeleton-prompt-contracts` (pass)
- `npm run test:knowledge-skeleton-repair-budget-contracts` (pass)
- `npm run test:knowledge-skeleton-adapter-contracts` (pass)
- `npm run test:knowledge-skeleton-golden-contracts` (pass)
- `npm run test:knowledge-skeleton-harness` (pass)
