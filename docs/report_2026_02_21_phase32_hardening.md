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

## Changes Applied

### A) Includes-based phase3 behavior checks replaced with executed contracts
- Replaced source-text assertions with direct function execution in:
  - `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs`
  - `src/server/scripts/test-analysis-router-contracts.mjs`
  - `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`
  - `src/server/scripts/test-skeleton-mode-guard-contracts.mjs`
- Added shared executed policy seams:
  - `src/server/src/llm/analyze/seedSpawnPolicy.ts`
  - `src/server/src/llm/analyze/pendingAnalysisTransitionPolicy.ts`
  - `src/server/src/llm/analyze/skeletonModeGuards.ts`
- Frontend policy wrappers now consume shared seams:
  - `src/playground/analysisSeedSpawnPolicy.ts`
  - `src/ai/analyzeMode.ts`
  - `src/playground/GraphPhysicsPlaygroundShell.tsx`

### B) End-to-end hydration determinism contract added
- Added chain helper:
  - `src/server/src/llm/analyze/skeletonHydration.ts:buildHydratedRuntimeSnapshot(...)`
- Chain validated in contract test:
  - `buildTopologyFromSkeletonCore -> applyTopologyToGraphState -> hydrateSkeletonNodePositions`
  - File: `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
- Determinism assertions now cover:
  - same seed => identical hydrated snapshot
  - different seed => at least one hydrated value differs
  - unicode rationale fixture path remains deterministic

### C) Pending consume identity key collision hardening
- Updated key generation in:
  - `src/server/src/llm/analyze/analysisFlowGuards.ts`
- Algorithm:
  - FNV-1a hash over payload content
  - text key = `kind + createdAt + length + hash(text)`
  - file key = `kind + createdAt + name + size + hash(name:size)`
- New contract checks:
  - same timestamp + same length + different content => different keys
  - identical payload => stable key
  - file/text payload transitions reset latch
  - File: `src/server/scripts/test-phase31-flow-guards-contracts.mjs`

### D) Generic Error code taxonomy stabilized
- Updated normalizer:
  - `src/server/src/llm/analyze/routerError.ts`
- Behavior:
  - known code-like messages remain preserved (for known codes set)
  - unknown runtime exceptions map to `unknown_error`
  - messages are whitespace-normalized and truncated to bounded length
- Contract coverage:
  - `src/server/scripts/test-analysis-router-contracts.mjs`

## Example Test Conversion (Before -> After)
- Before:
  - `source.includes("...")` check in `test-analysis-seed-spawn-gate-contracts.mjs`.
- After:
  - direct executed assertions calling `shouldSpawnSeedGraph(...)` with classic/skeleton inputs and expected booleans.

## Performance Notes
- Pending key hash cost is linear in payload text length and runs once per pending payload transition.
- No browser/runtime integration harness was introduced; all contracts run in Node and remain fast.

## Validation
- root: `npm run build`
- `src/server`: `npm run build`
- `src/server`: `npm run test:phase3`
