# Phase 3 Step 5: Verification Harness

## Scope
- Add one command to verify phase 3 contracts without LLM calls.
- Prove determinism, atomic apply ordering, classic no-regression, and fail-closed guards.
- Keep classic runtime behavior unchanged.

## Single Command
- From `src/server`:
  - `npm run test:phase3`

## Harness Structure
- Runner:
  - `src/server/scripts/test-phase3-verification-suite.mjs`
- Scripts executed by runner:
  - `test:knowledge-skeleton-golden-contracts`
  - `test:skeleton-topology-runtime-contracts`
  - `test:analysis-router-contracts`
  - `test:analysis-seed-spawn-gate-contracts`
  - `test:pending-to-graph-transition-contracts`
  - `test:llm-analyze-mode-gate-contracts`
  - `test:skeleton-mode-guard-contracts`

## Coverage Matrix
- Determinism:
  - `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
  - Verifies stable node order, stable edge order, seed-stable initial positions, and precision normalization.
  - Adds unicode rationale tie-break check for code-unit comparator stability.
- Atomicity and pending-to-reveal ordering contracts:
  - `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
  - `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`
  - Verifies single atomic apply callback and source-level ordering constraints in analysis completion flow.
- Classic no-regression:
  - `src/server/scripts/test-analysis-router-contracts.mjs`
  - `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs`
  - `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`
- Fail-closed guards:
  - `src/server/scripts/test-llm-analyze-mode-gate-contracts.mjs`
  - `src/server/scripts/test-skeleton-mode-guard-contracts.mjs`
  - `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`

## Expected Output
- Each sub-script logs its contract result and `done`.
- Runner summary line:
  - `[test:phase3] summary: passed=<N> failed=<M> total=<T>`
- Success line:
  - `[test:phase3] all phase3 verification contracts passed`

## Adding A New Golden Fixture
1. Add fixture JSON under `docs/fixtures/`.
2. Add fixture name to:
  - `src/server/scripts/test-knowledge-skeleton-golden-contracts.mjs`
  - `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
3. If order is deterministic and fixed, add expected node and edge order arrays in:
  - `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
4. Run:
  - `npm run build` (repo root)
  - `npm run build` (from `src/server`)
  - `npm run test:phase3` (from `src/server`)

## Troubleshooting
- `unexpected node order`:
  - Check sorting policy changes in `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts`.
- `initial position precision mismatch`:
  - Check placement rounding in `src/server/src/llm/analyze/skeletonTopologyBuild.ts`.
- `router error handling must happen before any skeleton topology apply`:
  - Check branch ordering in `src/document/nodeBinding.ts`.
- `mode gate behavior valid` fails:
  - Check server mode gate defaults in `src/server/src/routes/llmAnalyzeRoute.ts`.
