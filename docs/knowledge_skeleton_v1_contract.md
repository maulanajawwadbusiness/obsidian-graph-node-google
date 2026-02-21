# Knowledge Skeleton V1 Contract

## Purpose

`KnowledgeSkeletonV1` is a foundation contract for dynamic load-bearing knowledge structure.
Phase 1 scope is schema and validation foundation only. It is not wired into runtime analysis flow yet.

## Type Shape

```json
{
  "nodes": [
    {
      "role": "claim",
      "id": "n-1",
      "label": "Short label",
      "summary": "Short summary",
      "pressure": 0.7,
      "confidence": 0.8
    }
  ],
  "edges": [
    {
      "from": "n-1",
      "to": "n-2",
      "type": "supports",
      "weight": 0.6,
      "rationale": "Short rationale"
    }
  ]
}
```

## Node Fields

- `role`: enum
  - `claim | evidence | method | assumption | limitation | context`
- `id`: stable string id
- `label`: short label
- `summary`: 1-2 lines max
- `pressure`: number in `[0,1]`
- `confidence`: number in `[0,1]`

## Edge Fields

- `from`: node id
- `to`: node id
- `type`: enum
  - `supports | depends_on | produces | limits | challenges | operationalizes`
- `weight`: number in `[0,1]`
- `rationale`: short justification

## Global Constraints

- node count: min `3`, max `12`
- edge count: bounded by policy (Phase 1 default rule: `max(6, nodeCount * 2)`)
- all node ids must be unique
- all edges must reference existing node ids
- no self loops (`from !== to`)
- no orphan nodes (every node must have degree >= 1)
- readability caps:
  - label max chars: `80`
  - summary max chars: `240`
  - rationale max chars: `180`

## Source Of Truth

- shared module:
  - `src/server/src/llm/analyze/knowledgeSkeletonV1.ts`
- sample fixtures:
  - `docs/fixtures/knowledge_skeleton_v1_minimal.json`
  - `docs/fixtures/knowledge_skeleton_v1_typical.json`
  - `docs/fixtures/knowledge_skeleton_v1_bounds.json`

## Phase Boundary

This contract exists as bedrock for Phase 2 and Phase 3.
Current undercurrent prompt, node binding behavior, and runtime topology spawn path are intentionally unchanged in Phase 1.
