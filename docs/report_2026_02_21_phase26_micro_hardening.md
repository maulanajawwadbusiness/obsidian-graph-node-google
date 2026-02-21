# Phase 2.6 Micro-Hardening Report

Date: 2026-02-21

Scope:
- hardening only
- no phase 3 runtime wiring
- classic flow remains default

## A) Repair Loop Budgeting + Payload Shaping

### What changed
- Split repair budgets in `src/server/src/llm/analyze/skeletonAnalyze.ts`:
  - `MAX_PARSE_REPAIR_ATTEMPTS = 1`
  - `MAX_SEMANTIC_REPAIR_ATTEMPTS = 2`
  - `MAX_REPAIR_ERRORS_INCLUDED = 20`
- Parse retries are now independent from semantic retries on OpenRouter path.
- Added repair error summarization and truncation:
  - `summarizeValidationErrorsForRepair(...)`
  - includes top prioritized errors up to 20 entries
  - adds `+N more errors truncated` line when capped
- Kept document cap bounded and deterministic using head+tail strategy through:
  - `buildDocumentExcerptHeadTail(...)` in `src/server/src/llm/analyze/skeletonPrompt.ts`
  - excerpt cap remains `3000` chars

### Attempt behavior
- OpenRouter:
  - parse failures consume parse budget only
  - semantic validation failures consume semantic budget only
  - parse flakiness cannot starve semantic repairs
- OpenAI structured path:
  - semantic budget only

### Validation error priority order
1. `orphan_nodes_excessive`
2. `edge_from_missing_node`, `edge_to_missing_node`
3. `duplicate_edge_semantic`
4. `edge_count_out_of_range`
5. `unknown_property`
6. remaining errors sorted by path/code/message

### Excerpt strategy
- deterministic head+tail
- marker: `...[truncated]...`
- bounded by `repairDocumentExcerptMaxChars = 3000`

## B) Determinism Hardening (Locale-Independent)

### What changed
- Replaced locale-sensitive compares in `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts`:
  - removed `localeCompare(...)`
  - added code-unit comparator:
    - `a < b ? -1 : a > b ? 1 : 0`
- Applied comparator to:
  - node id tie-break
  - edge `from`, `to`, `type`, `rationale`
- Added final stable tie-break key compare for full ties.

### Why this matters
- avoids runtime/locale-dependent sort behavior
- stable ordering remains deterministic with unicode strings

## C) Mode Seam Guard Hardening

### What changed
- Centralized mode policy in `src/ai/analyzeMode.ts`:
  - `SKELETON_TOPOLOGY_WIRING_ENABLED = false`
  - `isSkeletonAnalyzeModeAllowed(...)`
  - `resolveAnalyzeRequestModeForFlags(...)`
  - `resolveAnalyzeRequestMode(...)`
- Guard requirements for `skeleton_v1`:
  - `ENABLE_SKELETON_ANALYZE_MODE`
  - `ACK_PHASE3_SKELETON_WIRING_COMPLETE`
  - `SKELETON_TOPOLOGY_WIRING_ENABLED`
- `src/ai/skeletonAnalyzer.ts` no longer hardcodes mode:
  - uses resolver and guard
  - throws `mode_guard_blocked` when blocked
  - prevents accidental bypass before phase 3

### Safe enable sequence (still pre-phase3 blocked by default)
1. keep all guard constants false in normal development and production.
2. phase 3 wiring must exist before toggling any skeleton mode constants.
3. only then enable all three guards in one place (`analyzeMode.ts`).

## Tests and Verification

Updated tests:
- `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs`
  - parse retry does not consume semantic budget
  - capped error summary contains orphan ids and truncation marker
- `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs`
  - deterministic excerpt head+tail, cap enforcement
- `src/server/scripts/test-knowledge-skeleton-adapter-contracts.mjs`
  - unicode determinism case
- `src/server/scripts/test-skeleton-mode-guard-contracts.mjs`
  - no hardcoded `mode: "skeleton_v1"` bypass
  - guard invariants present

Contracts suite registration:
- `src/server/package.json`
- `src/server/scripts/run-contract-suite.mjs`
