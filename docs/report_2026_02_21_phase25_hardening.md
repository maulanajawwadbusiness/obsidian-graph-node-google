# Phase 2.5 Hardening Report (Audit Fixes Before Phase 3)

## Run 1: Strict Schema Enforcement (Unknown Fields Rejected)

Date: 2026-02-21

Changes made:
- Server shape validator now rejects unknown keys at every skeleton layer:
  - root: `nodes`, `edges` only
  - node: `role`, `id`, `label`, `summary`, `pressure`, `confidence` only
  - edge: `from`, `to`, `type`, `weight`, `rationale` only
- Error code used: `unknown_property` with explicit property path.
- Frontend parser strictness is aligned automatically because frontend parser imports and uses the same validator module.

Code anchors:
- `src/server/src/llm/analyze/knowledgeSkeletonV1.ts`
  - helper: `collectUnknownPropertyErrors(...)`
  - usage in `validateKnowledgeSkeletonV1Shape(...)` at root, node, and edge passes

Tests added:
- `src/server/scripts/test-knowledge-skeleton-contracts.mjs`
  - invalid root extra field
  - invalid node extra field
  - invalid edge extra field

Sample error payload shape:
```json
{
  "code": "unknown_property",
  "message": "unknown property: extra_node",
  "path": "nodes[0].extra_node"
}
```
