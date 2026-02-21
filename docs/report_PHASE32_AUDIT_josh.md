# Phase 3.2 Audit Report (Josh)

Date: 2026-02-21
Scope: Audit-only verification of phase 3.2 hardening (no code changes)

## Executive Summary

1. Item 1 - remove `includes(...)` style phase3 harness checks: PASS
2. Item 2 - add end-to-end determinism check through hydration/runtime snapshot: PARTIAL
3. Item 3 - strengthen pending consume latch identity key (collision risk): PASS
4. Item 4 - stabilize generic `Error -> code` mapping (bounded taxonomy): PARTIAL

Overall gate call: PARTIAL PASS.
Phase3 harness quality and pending-key hardening improved materially. Remaining gaps are in determinism depth (still not full app runtime hydration path) and router code taxonomy consistency for object-shaped unknown errors.

## Item Verification

| Item | Status | Evidence Anchors | Notes |
| --- | --- | --- | --- |
| 1 | PASS | `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs:3`, `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs:13`, `src/server/scripts/test-analysis-router-contracts.mjs:3`, `src/server/scripts/test-pending-to-graph-transition-contracts.mjs:3`, `src/server/scripts/test-skeleton-mode-guard-contracts.mjs:3`, `src/server/scripts/test-phase3-verification-suite.mjs:5` | Phase3 scripts now execute imported dist functions/policies directly; no `source.includes(...)` behavior assertions remain in phase3 suite scripts. |
| 2 | PARTIAL | `src/server/src/llm/analyze/skeletonHydration.ts:35`, `src/server/src/llm/analyze/skeletonHydration.ts:44`, `src/server/src/llm/analyze/skeletonHydration.ts:47`, `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs:165`, `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs:175`, `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs:189` | New runtime snapshot chain exists (`buildTopologyFromSkeletonCore -> applyTopologyToGraphState -> hydrateSkeletonNodePositions`) and is tested for same-seed equality / different-seed delta. Gap: still not executing full frontend runtime hydration path (`nodeBinding -> engine.addNode`) as a contract. |
| 3 | PASS | `src/server/src/llm/analyze/analysisFlowGuards.ts:18`, `src/server/src/llm/analyze/analysisFlowGuards.ts:34`, `src/server/src/llm/analyze/analysisFlowGuards.ts:37`, `src/server/scripts/test-phase31-flow-guards-contracts.mjs:45`, `src/server/scripts/test-phase31-flow-guards-contracts.mjs:53`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1176` | Pending key now includes content hash (FNV-1a) and tests explicitly cover same-ms/same-length/different-content non-collision behavior plus stability for identical payload. |
| 4 | PARTIAL | `src/server/src/llm/analyze/routerError.ts:8`, `src/server/src/llm/analyze/routerError.ts:27`, `src/server/src/llm/analyze/routerError.ts:34`, `src/server/src/llm/analyze/routerError.ts:41`, `src/server/src/llm/analyze/routerError.ts:55`, `src/server/scripts/test-analysis-router-contracts.mjs:27` | `Error` instances now map unknowns to `unknown_error` with bounded message length. Hole: object-shaped errors with unknown `code` still pass through raw code (`code: code ?? fallbackFromMessage`) and bypass bounded taxonomy enforcement. |

## Findings Table

| Severity | Description | Evidence Anchors |
| --- | --- | --- |
| MED | Router taxonomy is only partially bounded: unknown object `code` values still leak through unchanged, while unknown `Error` values map to `unknown_error`. Mixed behavior can drift UI/telemetry contracts. | `src/server/src/llm/analyze/routerError.ts:41`, `src/server/src/llm/analyze/routerError.ts:55`, `src/server/scripts/test-analysis-router-contracts.mjs:27` |
| MED | Determinism contract is stronger but still not fully end-to-end through app runtime hydration (`nodeBinding` + engine snapshot). | `src/server/src/llm/analyze/skeletonHydration.ts:35`, `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs:165`, `src/document/nodeBinding.ts:257`, `src/document/nodeBinding.ts:273` |
| LOW | Pending payload hashing runs in effect path before early exits and can re-run across dependency-triggered effect cycles with large text payloads. Cost is linear in text size each run. | `src/playground/GraphPhysicsPlaygroundShell.tsx:1175`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1176`, `src/server/src/llm/analyze/analysisFlowGuards.ts:20` |
| LOW | Policy seam split risk remains: frontend runtime behavior uses shared policy modules under `src/server/src/llm/analyze/*`, while backend request gate uses its own route-local gate logic. They are conceptually related but not a single executable source of truth. | `src/ai/analyzeMode.ts:1`, `src/server/src/llm/analyze/skeletonModeGuards.ts:23`, `src/server/src/routes/llmAnalyzeRoute.ts:37` |

## New Risks Discovered

1. MED: Bounded error taxonomy remains inconsistent between `Error` branch and object-error branch.
2. MED: Determinism validation is not yet full runtime/app-path e2e.
3. LOW: Hashing overhead can scale with large pending text if effect runs frequently during warm path transitions.
4. LOW: Frontend and backend mode/policy seams can drift because not fully unified into one runtime contract.

## Phase3 Watchlist Update

1. `src/server/src/llm/analyze/routerError.ts`
- Keep error code taxonomy consistent across all branches (`Error`, object, fallback).

2. `src/server/src/llm/analyze/skeletonHydration.ts`
- Preserve deterministic snapshot ordering and single-apply behavior in any future extension.

3. `src/document/nodeBinding.ts`
- Add future contract coverage for deterministic hydrated node states after actual runtime apply path.

4. `src/playground/GraphPhysicsPlaygroundShell.tsx`
- Watch pending-key compute frequency and latch behavior under rapid re-submit and large text payloads.

5. `src/server/src/routes/llmAnalyzeRoute.ts` + `src/ai/analyzeMode.ts`
- Keep mode gate semantics aligned across server route gate and frontend resolver guards.

## Mitigations (Advice Only)

1. Apply bounded taxonomy in object-error branch as well (unknown object codes -> `unknown_error`), while preserving known code set.
2. Add one executed contract that runs a minimal runtime hydration path equivalent to `nodeBinding` output shape and compares stable node snapshots by seed.
3. Memoize or cache pending text hash per payload identity to avoid repeated O(n) hash work under repeated effect evaluations.
4. Add a cross-seam parity contract for frontend mode resolver vs backend gate expectations.

## Suite Sanity

Executed: `npm run test:phase3` from `src/server`.

Result: PASS (`passed=8 failed=0 total=8`) in about 4s wall time.

Assessment:
- Deterministic and fast in this run.
- Failure messages are concise and actionable.
- Remaining blind spots: rapid resubmit cancellation race, mid-run unmount behavior, duplicate-apply prevention under rerender storms, and stale pending payload replacement during in-flight async completion.
