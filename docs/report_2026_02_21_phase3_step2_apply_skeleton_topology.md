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
