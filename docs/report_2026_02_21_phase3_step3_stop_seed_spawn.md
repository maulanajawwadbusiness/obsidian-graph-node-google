# Phase 3 Step 3: Stop Seed Spawn For Skeleton Analysis Path

## Scope
- Implement mode-based gating so default seed graph spawn is skipped when analysis mode is `skeleton_v1` and pending analysis exists.
- Keep classic flow behavior unchanged.
- Do not wire skeleton topology apply yet.

## Current Seed Spawn Call Sites
- Analysis-start sensitive default spawn:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:937` `runDefaultSpawnOnce(...)`
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:948` `spawnGraph(4, 1337)`
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:951` init decision effect.
- Restore fallback spawn:
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1140` `runDefaultSpawnOnce('restore_failed')`
- Manual/debug spawn paths (unchanged, not analysis-start policy):
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1313`
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1370`
  - `src/playground/GraphPhysicsPlaygroundShell.tsx:1378`

## New Policy Seam
- File: `src/playground/analysisSeedSpawnPolicy.ts`
- Function: `shouldSpawnSeedGraphOnInit(...)`
- Inputs:
  - mode
  - hasPendingAnalysis
  - hasPendingRestore
  - hasRestoredSuccessfully
- Rule:
  - block spawn on pending restore/read paths
  - block spawn when `mode === "skeleton_v1"` and pending analysis exists
  - otherwise allow spawn

## Integration
- `src/playground/GraphPhysicsPlaygroundShell.tsx:51` imports mode resolver and policy seam.
- `src/playground/GraphPhysicsPlaygroundShell.tsx:954` now resolves mode via `resolveAnalyzeRequestMode()`.
- `src/playground/GraphPhysicsPlaygroundShell.tsx:955` delegates decision to `shouldSpawnSeedGraphOnInit(...)`.
- Dev logging includes skip reason and resolved mode for traceability.

## Invariants After This Step
- Classic mode keeps default spawn behavior.
- Skeleton mode (if forced for test/dev) no longer auto-spawns the 4-node seed in pending-analysis path.
- No change to classic analyzer/binder behavior.
- No topology-from-skeleton apply wiring yet.

## Pending Analysis Behavior In Skeleton Path (Step 3 Only)
- During pending analysis in skeleton mode, default seed spawn is skipped.
- This step does not introduce skeleton topology apply. That remains for the next step.
- Existing loading gate behavior remains unchanged.

## Verification
- Contract harness added:
  - `src/server/scripts/test-analysis-seed-spawn-gate-contracts.mjs`
- Contract suite wiring:
  - `src/server/package.json`
  - `src/server/scripts/run-contract-suite.mjs`
- Harness checks:
  - policy blocks seed spawn for `skeleton_v1` pending analysis
  - graph shell uses policy + `resolveAnalyzeRequestMode()`
  - classic default seed spawn path still exists

## Handoff To Step 4
- Step 4 should consume `kind === "skeleton_v1"` analysis results and apply topology via the step-2 seam:
  - `src/graph/skeletonTopologyRuntime.ts`
- This step intentionally only removes the old seed-mold in skeleton analysis start path.
