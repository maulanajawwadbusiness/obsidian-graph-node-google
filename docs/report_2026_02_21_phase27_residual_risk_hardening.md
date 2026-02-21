# Phase 2.7 Residual Risk Hardening

Date: 2026-02-21

Scope:
- micro-hardening only
- no phase 3 wiring
- classic default unchanged

## 1) Repair Context Mismatch Fix

Problem addressed:
- repair prompts were sometimes fed from a 2000-char debug preview path.

Changes:
- split context generation in `src/server/src/llm/analyze/skeletonAnalyze.ts`:
  - `toRawPreviewForLogs(...)` capped to `repairRawOutputPreviewMaxChars` (2000)
  - `toRepairContext(...)` capped to `repairInvalidJsonMaxChars` (8000)
- repair prompts now use repair context path:
  - semantic repair: `invalidJson: toRepairContext(...)`
  - parse repair: `rawOutputContext: toRepairContext(...)`
- log paths stay on 2000 preview only.

Related prompt change:
- `src/server/src/llm/analyze/skeletonPrompt.ts`
  - parse repair arg renamed to `rawOutputContext`
  - parse repair explicitly says corrected JSON must satisfy graph constraints

## 2) OpenRouter Total Call Cap

Problem addressed:
- worst-case path could exceed desired call budget.

Changes:
- added `MAX_TOTAL_MODEL_CALLS = 3` in `src/server/src/llm/analyze/skeletonAnalyze.ts`.
- OpenRouter schedule now enforced with split and total budgets:
  - parse retries max: `MAX_PARSE_REPAIR_ATTEMPTS = 1`
  - semantic retries max: `MAX_SEMANTIC_REPAIR_ATTEMPTS = 2`
  - if parse retry was used, semantic retries for that path are constrained to 1
  - total calls never exceed 3
- OpenAI structured path also respects total call cap 3.

Tradeoff:
- after parse repair, only one semantic retry is allowed to preserve global cap.

## 3) Server Mode Gate

Problem addressed:
- backend accepted `mode:"skeleton_v1"` from any caller.

Changes:
- `src/server/src/routes/llmAnalyzeRoute.ts`
  - added `SERVER_ALLOW_SKELETON_V1 = false` (local constant, non-env)
  - early gate:
    - if requested mode is `skeleton_v1` while guard is false, return 400
    - typed code: `MODE_DISABLED`
    - classic mode path unaffected
- typed code additions:
  - `src/server/src/routes/llmRouteDeps.ts`
  - `src/server/src/llm/requestFlow.ts`

## Tests Added/Updated

- `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs`
  - parse+semantic path stays within 3 calls
  - semantic-only failure path caps at 3 calls
  - repair context >2000 while preview stays <=2000 and repair <=8000
- `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs`
  - parse repair uses `rawOutputContext`
  - prompt size budget updated for 8000 repair context path
- `src/server/scripts/test-knowledge-skeleton-prompt-contracts.mjs`
  - parse repair API/constraint line coverage
- `src/server/scripts/test-requestflow-contracts.mjs`
  - includes `MODE_DISABLED` status matrix check
- new: `src/server/scripts/test-llm-analyze-mode-gate-contracts.mjs`
  - `skeleton_v1` rejected with `MODE_DISABLED`
  - classic mode continues normal route behavior
- suite wiring:
  - `src/server/package.json`
  - `src/server/scripts/run-contract-suite.mjs`
