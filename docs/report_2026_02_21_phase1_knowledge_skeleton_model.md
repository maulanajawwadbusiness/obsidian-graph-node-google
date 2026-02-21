# Phase 1 Knowledge Skeleton Model Report (2026-02-21)

## Scope

Phase 1 delivers schema, validator, parser, fixtures, and adapter bedrock only.
No runtime analysis behavior changed.

Explicitly unchanged:
- undercurrent prompt logic in `src/server/src/llm/analyze/prompt.ts`
- binding flow in `src/document/nodeBinding.ts`
- runtime spawn and topology creation in `src/playground/GraphPhysicsPlaygroundShell.tsx`

## Files Added Or Updated

Core contract:
- `src/server/src/llm/analyze/knowledgeSkeletonV1.ts`

Fixtures:
- `docs/fixtures/knowledge_skeleton_v1_minimal.json`
- `docs/fixtures/knowledge_skeleton_v1_typical.json`
- `docs/fixtures/knowledge_skeleton_v1_bounds.json`

Contract docs:
- `docs/knowledge_skeleton_v1_contract.md`

Server tests and wiring:
- `src/server/scripts/test-knowledge-skeleton-contracts.mjs`
- `src/server/scripts/test-knowledge-skeleton-adapter-contracts.mjs`
- `src/server/package.json` (new scripts)
- `src/server/scripts/run-contract-suite.mjs` (suite integration)

Frontend parser wrappers:
- `src/ai/knowledgeSkeletonV1Parser.ts`
- `src/ai/knowledgeSkeletonV1DevHarness.ts`

Adapter scaffold:
- `src/graph/knowledgeSkeletonAdapter.ts`
- `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts`

## Contract Invariants

Node model:
- `role`: `claim | evidence | method | assumption | limitation | context`
- `id`: stable string
- `label`: short text
- `summary`: concise text
- `pressure`: number in `[0,1]`
- `confidence`: number in `[0,1]`

Edge model:
- `from`, `to`: node ids
- `type`: `supports | depends_on | produces | limits | challenges | operationalizes`
- `weight`: number in `[0,1]`
- `rationale`: short text

Global constraints:
- node count `3..12`
- edge count `<= max(6, nodeCount * 2)`
- unique node ids
- edges must reference existing ids
- no self loops
- max length caps:
  - label `80`
  - summary `240`
  - rationale `180`
- orphan policy: zero orphan nodes (every node must have degree >= 1)

## Validator Layers

`src/server/src/llm/analyze/knowledgeSkeletonV1.ts` provides:
- shape validation: `validateKnowledgeSkeletonV1Shape(raw)`
- semantic validation: `validateKnowledgeSkeletonV1Semantic(value)`
- combined validation: `validateKnowledgeSkeletonV1(raw)`
- throw-seam for future route integration: `validateKnowledgeSkeletonV1OrThrow(raw)`
- typed failure class: `KnowledgeSkeletonValidationFailure`

Error payload model:
- `KnowledgeSkeletonValidationError { code, message, path? }`

## Frontend Parse Surface

`src/ai/knowledgeSkeletonV1Parser.ts` provides:
- `parseKnowledgeSkeletonV1Response(raw)`
- `assertSemanticKnowledgeSkeletonV1(value)`
- `KnowledgeSkeletonParseError`

Notes:
- frontend currently mirrors server rules via shared contract import
- parser is intentionally unused in runtime flow in Phase 1

## Adapter Invariants

`src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts` provides pure mapping core:
- `skeletonToTopologyCore(skeleton) -> { nodes, links }`

`src/graph/knowledgeSkeletonAdapter.ts` provides graph-facing typed adapter:
- `skeletonToTopology(skeleton) -> { nodes: NodeSpec[]; links: DirectedLink[] }`

Deterministic ordering rules:
- nodes sorted by `pressure desc`, then `id asc`
- edges sorted by `weight desc`, then `from asc`, then `to asc`, then `type asc`

Mapping details:
- node `label -> NodeSpec.label`
- node metadata preserved in `NodeSpec.meta`
- edge `type -> DirectedLink.kind`
- edge `rationale -> DirectedLink.meta.rationale`

## Test Coverage Added

Contract tests:
- `test:knowledge-skeleton-contracts`
  - valid fixtures pass
  - invalid matrix fails with expected codes:
    - bad enum
    - out-of-range numeric
    - missing node ref
    - duplicate id
    - too many nodes
    - too many edges
    - self loop

Adapter tests:
- `test:knowledge-skeleton-adapter-contracts`
  - fixture mapping preserves counts
  - ordering rules hold
  - mapping is deterministic across repeated calls

Suite integration:
- both new tests are included in `npm run test:contracts`

## Phase 2/3 Integration Seams (No Implementation Yet)

Phase 2 likely insertion points:
- backend analyze route parse gate:
  - `src/server/src/routes/llmAnalyzeRoute.ts`
- frontend parse gate:
  - `src/ai/paperAnalyzer.ts`

Phase 3 likely insertion points:
- topology-first bridge:
  - `src/graph/knowledgeSkeletonAdapter.ts`
  - `src/graph/topologyControl.ts`

## Risks And Guardrails

Primary risks if integrated later:
- mismatch between old analyze JSON shape and new skeleton shape
- introducing dynamic topology before restore/save version policy is updated
- over-strict semantic checks causing avoidable LLM reject loops

Guardrails established in Phase 1:
- no runtime wiring changes
- deterministic tests in server contract suite
- explicit throw and non-throw validator seams for controlled rollout

## Verification Snapshot

Phase 1 run gates executed after each run:
- root `npm run build`
- server `npm run build`
- server `npm run test:contracts`

All green at end of Phase 1.
