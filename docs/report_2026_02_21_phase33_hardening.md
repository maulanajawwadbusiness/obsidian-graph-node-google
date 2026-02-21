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

