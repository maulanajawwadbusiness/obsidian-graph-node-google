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

## Mini-Run 5 Finalization

### H2 Before/After (Error taxonomy)
- Before:
  - object-shaped `error.code` could pass through as-is (`src/server/src/llm/analyze/routerError.ts` pre-change branch).
- After:
  - bounded allowlist for router-exposed codes (`ALLOWED_ROUTER_ERROR_CODES`).
  - unknown object-shaped code is bucketed to `unknown_error`.
  - unknown original code is preserved in `details.original_code`.
  - generic `Error` uses allowlisted message-code when known, otherwise bounded fallback.

### H1 Before/After (Hydration determinism)
- Before:
  - determinism contracts validated helper-level hydration and single apply call.
- After:
  - contracts execute node materialization closer to app wiring:
    - topology apply
    - hydrated runtime node build
    - engine-like `addNode` ingestion and snapshot
  - determinism now asserted on that engine-ingested snapshot.

### R1 Before/After (Hash recomputation)
- Before:
  - key hashing could rerun when payload shape object was rebuilt at call site.
- After:
  - call site computes pending key via `useMemo` on payload identity.
  - guard module caches computed keys in a `WeakMap`.
  - contract asserts repeated identical payload identity computes hash once.

### R2 Before/After (Policy drift)
- Before:
  - frontend/shared and backend mode gates were tested separately.
- After:
  - parity contract fails if defaults or required guard semantics drift:
    - frontend/shared default classic
    - backend default skeleton disabled (`MODE_DISABLED`)
    - classic remains allowed
    - seed spawn policy remains classic-only for pending seed spawn

## Allowed Router Error Codes

- `unauthorized`
- `insufficient_balance`
- `insufficient_rupiah`
- `timeout`
- `MODE_DISABLED`
- `mode_disabled`
- `mode_guard_blocked`
- `validation_error`
- `network_error`
- `analysis_failed`
- `skeleton_analyze_failed`
- `skeleton_output_invalid`
- `parse_error`
- `upstream_error`
- `unknown_error`

## How To Run

From repo root:
- `npm run build`

From `src/server`:
- `npm run build`
- `npm run test:phase3`

## Notes

- Classic behavior and default guards remain unchanged.
- Skeleton mode defaults remain disabled on both frontend/shared guards and backend route gate.
