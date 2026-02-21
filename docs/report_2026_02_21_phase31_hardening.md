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

## Fixes Applied

### A) Classic error semantics preserved
- Before:
  - `src/ai/analysisRouter.ts` flattened classic failures to `analysis_failed`.
- After:
  - Added shared error normalization helper:
    - `src/server/src/llm/analyze/routerError.ts`
  - Router now preserves original `code/message/status/details` for classic and skeleton errors.
  - Node binding surfaces structured error payload via `AnalysisRunError`:
    - `src/document/nodeBinding.ts`.
- Coverage:
  - `src/server/scripts/test-analysis-router-contracts.mjs` validates pass-through preservation.

### B) Stale error leak race closed
- Before:
  - Error branch in node binding could run before stale gate.
- After:
  - Stale gate runs immediately after router result resolve and before any branch handling.
  - Shared stale helper:
    - `src/server/src/llm/analyze/analysisFlowGuards.ts:isStaleAnalysisResult`.
  - Node binding uses shared stale helper:
    - `src/document/nodeBinding.ts`.
- Coverage:
  - `src/server/scripts/test-phase31-flow-guards-contracts.mjs` run-order scenario checks for late run1 vs active run2.

### C) Pending consume latch warm-mount reset
- Before:
  - `hasConsumedPendingRef` could remain sticky across new submissions without remount.
- After:
  - Added payload-identity key and reset rule:
    - `buildPendingAnalysisPayloadKey(...)`
    - `shouldResetPendingConsumeLatch(...)`
    - in `src/server/src/llm/analyze/analysisFlowGuards.ts`.
  - Shell now resets latch on new pending identity:
    - `src/playground/GraphPhysicsPlaygroundShell.tsx`.
- Coverage:
  - `src/server/scripts/test-phase31-flow-guards-contracts.mjs`.
  - `test:phase3` now includes this executed guard script.

### D) Harness blind spots reduced
- Before:
  - Phase3 checks were mostly source-include seam contracts.
- After:
  - Added executed behavior contract:
    - `src/server/scripts/test-phase31-flow-guards-contracts.mjs`.
  - Added to suite:
    - `src/server/scripts/test-phase3-verification-suite.mjs`
    - `src/server/package.json` (`test:phase31-flow-guards-contracts`).

### E) Determinism asserted through hydration
- Before:
  - Determinism checked up to initial placement.
- After:
  - Added shared hydration mapping helper:
    - `src/server/src/llm/analyze/skeletonHydration.ts`.
  - Node binding hydration now uses shared helper:
    - `src/document/nodeBinding.ts`.
  - Runtime contracts now assert deterministic hydrated positions:
    - `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`.

## Validation
- Root build: `npm run build`
- Server build: `npm run build` (from `src/server`)
- Phase 3 suite: `npm run test:phase3` (from `src/server`)

## Invariants Preserved
- Classic mode remains default.
- Skeleton/client/server guards remain default-off.
- No topology-first mode enablement changes were introduced.
