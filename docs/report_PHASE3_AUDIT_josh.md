# Phase 3 Audit Report (Josh)

Date: 2026-02-21
Scope: Phase 3 steps 1-5 (spine-break plumbing), read-only audit, no code changes.

## Executive Summary (Top 5 Risks)

1. High: Classic error behavior regressed through router wrapping; specific classic failures are collapsed to `analysis_failed` before UI mapping.
2. High: Stale-result protection is ordered after router error handling, so stale errors are not discarded and can leak into active session state.
3. Medium: Pending-analysis consume latch (`hasConsumedPendingRef`) is never reset in-component, creating a risk of stuck/rejected re-submits in same warm runtime mount.
4. Medium: `test:phase3` passes, but several tests are source-string invariant checks, not runtime behavior checks; race/cancellation/double-apply paths remain under-covered.
5. Low-Medium: Determinism is strong in build/adapter paths, but phase3 harness does not fully assert runtime apply position parity after topology hydration.

## Findings Table

| Severity | Description | Evidence Anchors |
|---|---|---|
| High | **Classic no-regression violated in error semantics.** `analysisRouter` normalizes all classic failures to `code: "analysis_failed"`, and `nodeBinding` throws `analysis.error.code` first. This hides underlying classic error messages (`unauthorized`, `insufficient_balance`, etc.) that `toAnalysisErrorMessage(...)` relies on. | `src/ai/analysisRouter.ts:115`, `src/document/nodeBinding.ts:122`, `src/document/nodeBinding.ts:23` |
| High | **Stale error leak race.** In `applyAnalysisToNodes`, router error handling runs before stale doc-id check. A stale request that returns error can still set error state and throw, instead of being discarded. | `src/document/nodeBinding.ts:120`, `src/document/nodeBinding.ts:121`, `src/document/nodeBinding.ts:126` |
| Medium | **Potential re-submit deadlock/stuck path in warm runtime.** `hasConsumedPendingRef` is set to `true` for text/file consume paths but never reset to `false` in this component lifecycle. If another pending payload arrives without remount, effect short-circuits. | `src/playground/GraphPhysicsPlaygroundShell.tsx:175`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1167`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1187`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1251` |
| Medium | **Phase3 harness coverage has blind spots (runtime vs source invariants).** Multiple phase3 scripts validate with source `includes(...)` checks instead of executing behavior, so timing/race regressions can pass. | `src/server/scripts/test-analysis-router-contracts.mjs`, `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`, `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs` |
| Medium | **Missing explicit runtime test for “classic never calls skeleton apply seam”.** Current checks verify branch strings and presence, but do not execute runtime to assert zero `applySkeletonTopologyToRuntime` invocation on classic path. | `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`, `src/document/nodeBinding.ts:137`, `src/document/nodeBinding.ts:206` |
| Low | **Determinism validation is strong but not fully end-to-end through runtime hydration.** Contracts verify build/core order and seed-stable positions, but not final runtime node positions after `applySkeletonTopologyToRuntime` + engine rebuild. | `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`, `src/graph/skeletonTopologyRuntime.ts:52`, `src/document/nodeBinding.ts:213` |
| Low | **Classic path still uses locale-sensitive node sort.** Not new in phase3, but present in active classic binding path and can be locale-sensitive for non-ASCII ids. | `src/document/nodeBinding.ts:116` |

## Checks Requested vs Result

- Classic seed spawn unchanged: PASS
  - `spawnGraph(4, 1337)` still present and used in init policy flow.
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:948`, `src/playground/GraphPhysicsPlaygroundShell.tsx:957`
- Classic binding to existing nodes: PASS
  - explicit `analysis.kind === 'classic'` branch maps points to `orderedNodes`.
  - `src/document/nodeBinding.ts:137`
- Classic does not call skeleton apply seam: PASS (by branch logic), but runtime test missing.
  - `src/document/nodeBinding.ts:206`
- Skeleton path no seed in pending-analysis mode: PASS
  - `shouldSpawnSeedGraphOnInit` blocks `skeleton_v1 + pendingAnalysis`.
  - `src/playground/analysisSeedSpawnPolicy.ts:15`
- Skeleton apply atomic one-call seam: PASS
  - `applyTopologyToGraphState(...apply...)` and contract asserts one callback call.
  - `src/graph/skeletonTopologyRuntime.ts:61`, `src/server/scripts/test-skeleton-topology-runtime-contracts.mjs`
- Pending consume delayed for skeleton: PASS
  - `shouldDelayPendingConsume = requestMode === 'skeleton_v1'` and delayed `consumePendingAnalysis()`.
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1181`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1239`
- Reveal after apply/loading completes: PASS by loading gate contract
  - gate phase depends on runtime loading state and confirm done flow.
  - `src/screens/appshell/render/graphLoadingGateMachine.ts:64`, `src/screens/AppShell.tsx:690`
- Deterministic ordering/seeded placement: PASS for build contracts
  - code-unit comparator + seeded mulberry + 6-decimal rounding.
  - `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts:21`, `src/server/src/llm/analyze/skeletonTopologyBuild.ts:35`, `src/server/src/llm/analyze/skeletonTopologyBuild.ts:67`
- Mode gates fail-closed (client+server): PASS
  - client triple guard defaults false; server `MODE_DISABLED` default deny.
  - `src/ai/analyzeMode.ts:3`, `src/ai/analyzeMode.ts:5`, `src/server/src/routes/llmAnalyzeRoute.ts:36`, `src/server/src/routes/llmAnalyzeRoute.ts:45`
- Bypass call-sites: PASS for direct hardcoded `mode: "skeleton_v1"` in active client path.
  - `skeletonAnalyzer` now uses resolver and blocks via guard.
  - `src/ai/skeletonAnalyzer.ts:101`, `src/ai/skeletonAnalyzer.ts:115`

## Harness Reliability (Step 5)

Executed:
- `npm run test:phase3` from `src/server` (PASS)
- suite output summary confirmed `passed=7 failed=0 total=7`.

Assessment:
- Deterministic and fast: PASS (local run ~3.4s).
- Actionable failures: mostly PASS (script-specific error tags are clear).
- Coverage gaps remain:
  - mid-run cancellation / quick re-submit race not executed.
  - duplicate apply protection on re-render loops not executed.
  - stuck pending state not executed.
  - classic runtime guarantee for no skeleton apply is asserted structurally, not behaviorally.

## Phase 3 Watchlist (Exact Seams)

1. `src/document/nodeBinding.ts:120` (router result handling and stale-check ordering)
2. `src/document/nodeBinding.ts:122` (error normalization/propagation)
3. `src/playground/GraphPhysicsPlaygroundShell.tsx:1167` (`hasConsumedPendingRef` consume latch)
4. `src/playground/GraphPhysicsPlaygroundShell.tsx:1181` (skeleton delayed consume ordering)
5. `src/graph/skeletonTopologyRuntime.ts:52` (single atomic topology apply seam)
6. `src/server/src/llm/analyze/skeletonTopologyBuild.ts:44` (seeded placement determinism)
7. `src/screens/AppShell.tsx:690` + `src/screens/appshell/render/graphLoadingGateMachine.ts:64` (loading-to-reveal gate contract)
8. `src/server/src/routes/llmAnalyzeRoute.ts:45` (server mode-disabled safety default)

## Recommended Mitigations (Advice Only)

1. Preserve original classic error semantics through router (`message-first` or typed passthrough), so `toAnalysisErrorMessage` keeps auth/balance/network specificity.
2. Move stale-check ahead of router error throw in `applyAnalysisToNodes` so stale failures are fail-silent like stale successes.
3. Add explicit pending-consume latch reset keyed by pending payload identity (createdAt/doc id) to avoid stuck re-submits in warm runtime.
4. Extend `test:phase3` with at least one execution-level contract that simulates: classic run, skeleton forced run, quick resubmit/cancel, and verifies apply seam invocation counts.
5. Add a runtime-level assertion that classic branch never reaches `applySkeletonTopologyToRuntime` (spy/counter in harness).

