# Phase 1 + 2 Audit (Josh)

Date: 2026-02-21
Scope: Phase 1 and Phase 2 knowledge skeleton foundation and integration seams only. No code changes made.

## Executive Summary (Top 5 Risks)

1. Runtime contract drift risk: `additionalProperties: false` exists in JSON schema, but non-OpenAI runtime validation does not enforce unknown fields.
2. OpenRouter parse failures bypass repair: parse errors return immediately and do not enter the repair loop.
3. Prompt/validator mismatch on edge policy: prompt does not state hard edge cap formula, while validator enforces `<= max(6, nodeCount * 2)`.
4. Repair token blowup risk: each repair prompt re-includes full document excerpt plus invalid JSON preview.
5. Phase 3 activation seam is not end-to-end yet: frontend mode toggle can request `skeleton_v1`, but `paperAnalyzer` still expects classic payload shape.

## Findings

| Severity | Finding | Anchors |
|---|---|---|
| High | **Schema drift gap: unknown fields are allowed at runtime for skeleton objects/nodes/edges.** Schema builder declares `additionalProperties: false`, but `validateKnowledgeSkeletonV1Shape` checks required typed fields only and never rejects extra keys. This can silently accept contract drift, especially on OpenRouter path. | `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:84`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:99`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:104`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:204` |
| High | **OpenRouter parse errors do not get repair attempts.** `tryParseJson` failures return `parse_error` from `runOpenrouterSkeletonPass`, and main loop exits immediately (`if (pass.ok === false) return pass`). This increases fragility for fenced JSON, pre/post text, or malformed commas. | `src/server/src/llm/analyze/skeletonAnalyze.ts:52`, `src/server/src/llm/analyze/skeletonAnalyze.ts:97`, `src/server/src/llm/analyze/skeletonAnalyze.ts:101`, `src/server/src/llm/analyze/skeletonAnalyze.ts:134` |
| High | **Prompt lacks hard edge-cap instruction while validator enforces hard cap.** Prompt says "avoid edge spam" but not explicit max formula. This can cause repeated repair failures (mechanical over-linking then cap violations), especially with orphan rule pressure. | `src/server/src/llm/analyze/skeletonPrompt.ts:46`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:126`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:384`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:426` |
| Medium | **Repair loop can become costly and timeout-prone on large inputs.** Up to 2 repairs (`MAX_REPAIR_ATTEMPTS=2`) each include full `Document excerpt` and invalid JSON preview (up to 12k chars), while allowed text input is up to 80k chars. | `src/server/src/llm/analyze/skeletonAnalyze.ts:33`, `src/server/src/llm/analyze/skeletonAnalyze.ts:71`, `src/server/src/llm/analyze/skeletonAnalyze.ts:163`, `src/server/src/llm/analyze/skeletonPrompt.ts:80`, `src/server/src/llm/limits.ts:3` |
| Medium | **Validation errors are typed, but some are not actionable enough for repair.** `orphan_nodes_excessive` reports only path `edges` with no orphan node ids, which weakens model-guided correction quality. | `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:426`, `src/server/src/llm/analyze/skeletonAnalyze.ts:35` |
| Medium | **Determinism tie-breaker gap for exact duplicate edges.** Adapter ordering breaks ties by `weight/from/to/type`; exact duplicates keep input order. Downstream ID generation (`ensureDirectedLinkIds`) is order-sensitive for index suffixes, so equivalent duplicate sets can yield different IDs across runs. | `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:26`, `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:38`, `src/graph/directedLinkId.ts:44`, `src/graph/topologyControl.ts:209` |
| Medium | **Spaghetti risk remains: duplicate semantic edges are currently valid.** Validator blocks self-loops and missing refs but does not reject repeated same `(from,to,type)` edges. This can produce mechanically dense outputs even if valid. | `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:131`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:419`, `src/server/src/llm/analyze/knowledgeSkeletonV1.ts:426` |
| Medium | **Harness coverage gap for negative/boundary cases.** Existing tests verify core invalid matrix and golden coverage, but there are no explicit negatives for extra properties, unicode/normalization oddities, near-boundary whitespace-only strings, or repeated duplicate edges. | `src/server/scripts/test-knowledge-skeleton-contracts.mjs:42`, `src/server/scripts/test-knowledge-skeleton-contracts.mjs:111`, `src/server/scripts/test-knowledge-skeleton-golden-contracts.mjs:28`, `src/server/scripts/test-knowledge-skeleton-golden-contracts.mjs:55` |
| Low | **Root-level script ergonomics gap.** Skeleton harness/contract scripts are only in `src/server/package.json`; root `package.json` does not expose wrappers, so "from root" execution is not one-command. | `src/server/package.json:30`, `src/server/package.json:34`, `package.json:9`, `package.json:13` |
| Medium | **Phase 3 seam hazard if mode is toggled early.** Frontend mode seam exists, but `paperAnalyzer` still parses classic structure (`main_points/links`). If `resolveAnalyzeRequestMode()` flips to `skeleton_v1` before topology consumption path is wired, analysis flow will fail. | `src/ai/analyzeMode.ts:5`, `src/ai/paperAnalyzer.ts:359`, `src/ai/paperAnalyzer.ts:488`, `src/ai/paperAnalyzer.ts:497`, `src/server/src/routes/llmAnalyzeRoute.ts:731` |

## Recommended Mitigations (No Code Changes Applied)

1. Align runtime validator strictness with schema strictness, or explicitly document intentional tolerance for unknown fields.
2. Add parse-repair handling for OpenRouter `parse_error` (at least one recovery attempt with compact parse-failure feedback).
3. Make edge policy explicit in prompt text (`edges <= max(6, nodeCount * 2)`) and optionally add duplicate-edge policy.
4. Cap repair prompt payload size for document excerpt and validation context to reduce timeout/token blowup.
5. Improve error payload specificity for orphans (include orphan node ids) to reduce repair oscillation.
6. For phase 3 determinism, define duplicate-edge canonicalization policy before `setTopology` handoff.
7. Extend harness with targeted negatives: extra keys, unicode edge cases, whitespace-only fields, repeated identical edges, and near-limit length cases.
8. Add root script passthroughs if root execution ergonomics is required by team workflow.

## Phase 3 Watchlist (Exact Seams)

1. Mode switch seam: `src/ai/analyzeMode.ts:5`.
2. Response-shape fork seam (classic vs skeleton): `src/ai/paperAnalyzer.ts:359`, `src/ai/paperAnalyzer.ts:488`.
3. Backend mode branch + payload contract: `src/server/src/routes/llmAnalyzeRoute.ts:395`, `src/server/src/routes/llmAnalyzeRoute.ts:731`.
4. Skeleton-to-topology adapter seam: `src/graph/knowledgeSkeletonAdapter.ts:5`, `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:33`.
5. Topology mutation seam (must stay single entry): `src/graph/topologyControl.ts:203`.
6. Current classic binder (index-based) that phase 3 must bypass/replace carefully: `src/document/nodeBinding.ts:73`.

## Verification Notes

Executed (read-only audit validation):
- `npm run test:knowledge-skeleton-contracts` (pass)
- `npm run test:knowledge-skeleton-adapter-contracts` (pass)
- `npm run test:knowledge-skeleton-golden-contracts` (pass)
- `npm run test:knowledge-skeleton-harness` (pass)
