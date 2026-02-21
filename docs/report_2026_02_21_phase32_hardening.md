# Phase 3.2 Hardening Report

## Forensic Targets

### 1) Remaining includes-based behavior contracts
- `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs`
  - Previously asserted behavior using `source.includes(...)`.
- `src/server/scripts/test-analysis-router-contracts.mjs`
  - Previously mixed source-structure checks with behavior claims.
- `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`
  - Previously asserted transition behavior via source string checks.

### 2) Hydration determinism boundary
- Deterministic placement source:
  - `src/server/src/llm/analyze/skeletonTopologyBuild.ts`
- Runtime apply seam:
  - `src/graph/skeletonTopologyRuntime.ts`
- Hydration mapping used by binding:
  - `src/server/src/llm/analyze/skeletonHydration.ts`
  - `src/document/nodeBinding.ts`

### 3) Pending latch identity key collision risk
- Key builder:
  - `src/server/src/llm/analyze/analysisFlowGuards.ts`
- Current shape (before phase 3.2):
  - text key used `createdAt + text length`, collision-prone for same timestamp/length.

### 4) Generic Error normalization stability
- Error normalizer:
  - `src/server/src/llm/analyze/routerError.ts`
- Current shape (before phase 3.2):
  - generic `Error` code could derive from message text.
