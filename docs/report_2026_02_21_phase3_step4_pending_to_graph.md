# Phase 3 Step 4: PendingAnalysis To Graph Transition (Skeleton Topology-First)

## Scope
- Wire transition ordering so skeleton mode applies topology before graph reveal.
- Keep classic analysis flow behavior unchanged.
- Keep skeleton mode guards and server mode gate defaults unchanged.

## Transition Owner
- Primary owner: `src/playground/GraphPhysicsPlaygroundShell.tsx` pending-analysis consume effect.
- Analysis completion owner: `src/document/nodeBinding.ts` via `applyAnalysisToNodes(...)`.
- Gate visibility owner: `src/screens/AppShell.tsx` + `src/screens/appshell/render/graphLoadingGateMachine.ts`.

## Anchors
- Pending set from prompt:
  - `src/screens/appshell/render/renderScreenContent.tsx:217`
- Pending consumed callback into AppShell state:
  - `src/screens/appshell/render/renderScreenContent.tsx:131`
- Graph pending-analysis consume flow:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1154`
- Runtime loading status source:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1467`
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1478`
- Gate base phase logic:
  - `src/screens/appshell/render/graphLoadingGateMachine.ts:47`

## Behavior Changes
- Skeleton path now allows analysis-start with zero seeded nodes:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx` guard uses:
    - `engineRef.current.nodes.size === 0 && requestMode !== 'skeleton_v1'`
- Skeleton path delays pending consume until async completion/failure:
  - `shouldDelayPendingConsume` and `consumePendingAnalysis()` in
  - `src/playground/GraphPhysicsPlaygroundShell.tsx`
- Analysis completion in node binding now supports router union:
  - classic branch preserved
  - skeleton branch applies step-2 seam:
    - `applySkeletonTopologyToRuntime(...)`
  - file: `src/document/nodeBinding.ts`

## Sequence: Classic (unchanged)
1. prompt submit sets `pendingAnalysis`.
2. graph consume starts and consumes pending immediately.
3. classic analysis runs and binds by existing nodes.
4. topology set + engine rebuild.
5. loading state exits and gate can complete.

## Sequence: Skeleton (forced/test path)
1. prompt submit sets `pendingAnalysis`.
2. seed graph is skipped from step 3 policy.
3. graph consume starts, but pending consume is delayed.
4. analysis returns `kind: "skeleton_v1"` from router path.
5. topology is applied atomically via `applySkeletonTopologyToRuntime(...)`.
6. engine nodes/links are rebuilt from final topology.
7. pending is consumed after completion, loading exits, then graph is revealed.

## Failure Mode Contract
- Router error (`MODE_DISABLED`, `mode_guard_blocked`, analyze failure):
  - node binding throws error path
  - no skeleton topology apply call
  - pending consume still executes on delayed path
  - loading state exits and gate error can surface.
- Invalid file / parse failures on file path:
  - pending consume still executes on delayed skeleton path before return.

## Invariants
- No skeleton graph reveal before topology apply/hydration completes.
- Classic flow remains preserved from user perspective.
- Step 4 does not loosen mode gates:
  - client analyze-mode guards remain off by default
  - server `skeleton_v1` mode gate remains disabled by default.

## Contract Harness Coverage
- Added script:
  - `src/server/scripts/test-pending-to-graph-transition-contracts.mjs`
- Registered in:
  - `src/server/package.json`
  - `src/server/scripts/run-contract-suite.mjs`
- Harness asserts:
  - skeleton completion uses topology apply seam
  - graph shell delays pending consume for skeleton mode
  - classic branch remains explicit and available.

## Step 5 Handoff
- Step 5 should expand verification from source/contract checks to deeper runtime integration checks.
- No additional behavior changes are required before step 5 validation expansion.
