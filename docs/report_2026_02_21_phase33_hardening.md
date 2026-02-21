# Phase 3.3 Hardening Report

## Forensic Targets

### H1) Runtime hydration determinism not close enough to app wiring
- App hydration path:
  - `src/document/nodeBinding.ts:99` (`buildPhysicsNodesFromTopology`)
  - `src/document/nodeBinding.ts:273` (`engine.addNode` loop)
- Current hydration helper:
  - `src/server/src/llm/analyze/skeletonHydration.ts:10`
  - `src/server/src/llm/analyze/skeletonHydration.ts:35`

### H2) Error taxonomy can leak unbounded object-shaped codes
- Normalizer branch:
  - `src/server/src/llm/analyze/routerError.ts:41`
- Frontend consumer:
  - `src/ai/analysisRouter.ts:40`

### R1) Pending payload hash recomputation risk
- Key builder:
  - `src/server/src/llm/analyze/analysisFlowGuards.ts:31`
- Call site that recreates payload object:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1176`

### R2) Policy seam drift risk between frontend and backend
- Frontend mode guard seam:
  - `src/ai/analyzeMode.ts:1`
- Backend mode gate seam:
  - `src/server/src/routes/llmAnalyzeRoute.ts:37`

## Mini-Run 2 Changes (H2)

- Added bounded allowlist for surfaced router error codes:
  - `src/server/src/llm/analyze/routerError.ts:8`
- Error normalization now buckets unknown object-shaped codes to `unknown_error`.
- Unknown object-shaped code preserves original value in `details.original_code`.
- Generic `Error` no longer derives code from message text.
- Updated contracts:
  - `src/server/scripts/test-analysis-router-contracts.mjs`

## Mini-Run 3 Changes (H1)

- Added shared runtime-node hydration mapper used by app binding and contracts:
  - `src/server/src/llm/analyze/skeletonHydration.ts:32` (`buildHydratedRuntimeNodes`)
- Updated app binding to consume the shared mapper:
  - `src/document/nodeBinding.ts` (`buildPhysicsNodesFromTopology`)
- Extended hydration snapshot contract to execute node materialization with an engine mock (`addNode` path):
  - `src/server/src/llm/analyze/skeletonHydration.ts:67`
  - `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`

## Mini-Run 4 Changes (R1, R2)

- Added pending-key memoization cache and test counters:
  - `src/server/src/llm/analyze/analysisFlowGuards.ts`
- Added shell-level memoization to avoid re-hashing recreated payload shapes:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx`
- Added memoization contract:
  - `src/server/scripts/test-phase31-flow-guards-contracts.mjs`
- Added frontend/backend policy parity contract:
  - `src/server/scripts/test-phase33-policy-parity-contracts.mjs`
- Included parity contract in phase3 runner:
  - `src/server/scripts/test-phase3-verification-suite.mjs`
  - `src/server/package.json`
