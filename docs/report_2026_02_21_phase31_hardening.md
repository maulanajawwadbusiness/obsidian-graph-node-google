# Phase 3.1 Hardening Report

## Forensic Anchors

### 1) Classic error flattening in router
- Router classic catch path currently maps all failures into generic error kind:
  - `src/ai/analysisRouter.ts` in `runAnalysis(...)` classic `catch` branch.
- Classic analyzer source errors originate from:
  - `src/ai/paperAnalyzer.ts` in `analyzeDocument(...)` and include codes such as `unauthorized`, `insufficient_balance`, `timeout`.

### 2) Stale error leak ordering
- Analysis result stale gate is in node binding:
  - `src/document/nodeBinding.ts` in `applyAnalysisToNodes(...)`.
- The ordering we need to harden is around:
  - `runAnalysis(...)` resolution
  - stale document id compare
  - router error throw path

### 3) Pending consume latch lifecycle
- Pending consume latch:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx`
  - `hasConsumedPendingRef`
  - pending consume effect that handles `pendingAnalysisPayload`.

### 4) Harness blind spots
- Current phase3 suite runner:
  - `src/server/scripts/test-phase3-verification-suite.mjs`
- Current contract scripts still include source-string assertions:
  - `src/server/scripts/test-analysis-router-contracts.mjs`
  - `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`

### 5) Determinism boundary (placement vs hydration)
- Deterministic placement and atomic apply checks:
  - `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
  - `src/server/src/llm/analyze/skeletonTopologyBuild.ts`
  - `src/graph/skeletonTopologyRuntime.ts`
- Hydration path into engine nodes:
  - `src/document/nodeBinding.ts` in `buildPhysicsNodesFromTopology(...)`.

## Run Notes
- This report is updated per mini-run with before/after and new contract coverage.
