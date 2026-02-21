# Phase 3.1 Audit Report (Josh)

Date: 2026-02-21
Scope: Audit-only verification of phase 3.1 hardening items (no code changes)

## Executive Summary

1. Item 1 - Classic error semantics flattened (router): PASS
2. Item 2 - Stale error leak race: PASS
3. Item 3 - Pending consume latch warm-mount reset: PASS (with a minor key-collision caveat)
4. Item 4 - Harness blind spots reduced: PARTIAL
5. Item 5 - Determinism asserted through hydration: PARTIAL

Overall gate call: PARTIAL PASS.
The core runtime fixes are in place for 1-3. Test/harness hardening improved, but phase3 suite still has source-string contract checks for critical seams and does not fully execute end-to-end runtime hydration through `nodeBinding` plus engine state.

## Item-by-Item Verification

| Item | Status | Evidence Anchors | Notes |
| --- | --- | --- | --- |
| 1 | PASS | `src/ai/analysisRouter.ts:118`, `src/ai/analysisRouter.ts:121`, `src/server/src/llm/analyze/routerError.ts:8`, `src/server/src/llm/analyze/routerError.ts:19`, `src/server/src/llm/analyze/routerError.ts:34`, `src/document/nodeBinding.ts:32`, `src/document/nodeBinding.ts:175`, `src/document/nodeBinding.ts:366` | Classic catch now routes through `normalizeRouterError(...)`, preserving structured payload when available (`code/message/status/details`), then `nodeBinding` throws `AnalysisRunError(analysis.error)` and maps UI message from code+message via `toAnalysisErrorMessage`. |
| 2 | PASS | `src/document/nodeBinding.ts:167`, `src/document/nodeBinding.ts:169`, `src/document/nodeBinding.ts:175`, `src/server/src/llm/analyze/analysisFlowGuards.ts:18`, `src/server/scripts/test-phase31-flow-guards-contracts.mjs:15` | Stale gate runs immediately after `runAnalysis(...)` resolves and before `analysis.kind === 'error'`, so late stale error results are discarded instead of surfaced. Contract test executes stale checks. |
| 3 | PASS | `src/playground/GraphPhysicsPlaygroundShell.tsx:1171`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1189`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1192`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1194`, `src/server/src/llm/analyze/analysisFlowGuards.ts:22`, `src/server/src/llm/analyze/analysisFlowGuards.ts:31`, `src/server/scripts/test-phase31-flow-guards-contracts.mjs:42` | Latch reset is now keyed by pending payload identity (`buildPendingAnalysisPayloadKey` + `shouldResetPendingConsumeLatch`). Warm-mount second submission resets consume lock without requiring remount. |
| 4 | PARTIAL | `src/server/scripts/test-phase3-verification-suite.mjs:5`, `src/server/scripts/test-phase3-verification-suite.mjs:11`, `src/server/scripts/test-phase31-flow-guards-contracts.mjs:3`, `src/server/scripts/test-analysis-router-contracts.mjs:26`, `src/server/scripts/test-pending-to-graph-transition-contracts.mjs:26`, `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs:22`, `src/server/scripts/test-skeleton-mode-guard-contracts.mjs:22` | New executed behavior test exists (`phase31-flow-guards`) and is wired into `test:phase3`. But several key phase3 scripts still rely heavily on `source.includes(...)` checks, not runtime-executed behavior with mocked runtime API/order assertions. |
| 5 | PARTIAL | `src/document/nodeBinding.ts:14`, `src/document/nodeBinding.ts:105`, `src/server/src/llm/analyze/skeletonHydration.ts:10`, `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs:165`, `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs:175` | Determinism is asserted for placement plus hydration helper output by seed. However, test does not execute full `nodeBinding -> engine.addNode` hydration path and compare runtime node state snapshots end-to-end. |

## Findings Table

| Severity | Description | Evidence Anchors |
| --- | --- | --- |
| MED | Phase3 harness still has blind spots from source-string assertions in critical seam tests; regressions can pass if string markers remain but runtime behavior changes. | `src/server/scripts/test-analysis-router-contracts.mjs:26`, `src/server/scripts/test-pending-to-graph-transition-contracts.mjs:26`, `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs:22`, `src/server/scripts/test-skeleton-mode-guard-contracts.mjs:22` |
| MED | Determinism coverage stops at helper-level hydration; no contract currently validates deterministic hydrated coordinates after `nodeBinding` runtime application into engine state. | `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs:165`, `src/document/nodeBinding.ts:257`, `src/document/nodeBinding.ts:273` |
| LOW | Pending latch key for text uses `createdAt + text.length`; two submissions with same timestamp bucket and equal length can collide and skip intended reset in pathological rapid-submit cases. | `src/server/src/llm/analyze/analysisFlowGuards.ts:24`, `src/server/src/llm/analyze/analysisFlowGuards.ts:26` |
| LOW | Error normalization fallback can still degrade code taxonomy for generic thrown `Error` text (code becomes full message); UI mapping remains robust but analytics/contract code stability can vary for non-standard throws. | `src/server/src/llm/analyze/routerError.ts:34`, `src/server/src/llm/analyze/routerError.ts:37`, `src/document/nodeBinding.ts:59` |

## New Risks Discovered

1. MED: Harness confidence gap remains for behavior-level phase3 seams due `includes`-style assertions.
2. MED: End-to-end hydration determinism into runtime state is not explicitly contract-tested.
3. LOW: Pending latch identity key may collide in extreme same-ms same-length text submissions.
4. LOW: Non-typed thrown errors can still produce unstable `code` strings even though user-facing message mapping is safe.

## Phase 3 Watchlist Update

1. `src/document/nodeBinding.ts` (`applyAnalysisToNodes`, `buildPhysicsNodesFromTopology`)
- Keep stale gate ordering before all result branches.
- Any future refactor must preserve deterministic node ordering and hydration mapping.

2. `src/playground/GraphPhysicsPlaygroundShell.tsx` (pending consume effect)
- Preserve keyed latch reset semantics and delayed consume behavior for skeleton path.
- Re-check race behavior on rapid re-submit and pending payload replacement.

3. `src/server/src/llm/analyze/analysisFlowGuards.ts`
- This is now a shared seam for stale/latch logic; avoid duplicate local logic in shell/router.

4. `src/server/scripts/test-phase3-verification-suite.mjs` + phase3 contract scripts
- Future hardening should shift remaining source-text contracts to executed behavior contracts with mock runtime APIs and ordering assertions.

5. `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
- Extend coverage from placement/hydration helper determinism into runtime hydration application semantics.

## Mitigations (Advice Only)

1. Convert remaining `includes`-style phase3 scripts to executed behavior tests first (router + pending-to-graph + seed gate + mode guard).
2. Add a runtime-level determinism contract that executes `nodeBinding` hydration mapping and snapshots engine node positions for same fixture/seed repeatability.
3. Strengthen pending payload key with a stable content fingerprint (or higher-entropy key fields) to avoid same-ms length-collision edge cases.
4. Keep `analysisFlowGuards` as single source for stale/latch decisions; reject future duplicate logic forks.

## Phase3 Suite Run

Executed: `npm run test:phase3` from `src/server`.

Result: PASS (`passed=8 failed=0 total=8`).
Runtime was deterministic and fast in this run (about 4s wall time), and failure messages are concise/actionable at script level.
