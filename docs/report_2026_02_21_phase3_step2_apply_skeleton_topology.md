# Phase 3 Step 2: Apply Skeleton Topology

## Scope
- Build deterministic conversion from `KnowledgeSkeletonV1` to graph topology specs.
- Add atomic apply seam callable without LLM or UI wiring.
- Keep classic flow unchanged.

## Target Types and Seams
- `DirectedLink` and `NodeSpec` runtime topology types:
  - `src/graph/topologyTypes.ts`
- Atomic mutation seam:
  - `setTopology(topology, config, meta)` in `src/graph/topologyControl.ts`
- Existing skeleton conversion core:
  - `skeletonToTopologyCore(skeleton)` in `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts`

## Notes
- This step does not change node binding behavior or spawn behavior.
- Runtime wiring of skeleton mode remains for step 3.

## Placement Algorithm
- Module: `src/server/src/llm/analyze/skeletonTopologyBuild.ts`
- Strategy: deterministic radial placement with seeded jitter.
- Defaults:
  - `seed=1337`
  - `center=(0,0)`
  - `radius=220`
  - `jitter=18`
- Determinism rule:
  - same skeleton node order + same seed => same initial positions.
  - position values are rounded to 6 decimals for stable equality checks.

## Runtime Apply Seam
- Module: `src/graph/skeletonTopologyRuntime.ts`
- `buildTopologyFromSkeleton(...)` returns topology + initial positions + summary.
- `applySkeletonTopologyToRuntime(...)` applies topology atomically through one mutation call.
- No runtime call-site is switched in this step.
