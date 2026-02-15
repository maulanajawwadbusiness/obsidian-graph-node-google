# Step 3 Hardening Run 7: Semantic Validator v1 (Topology/Layout)

Date: 2026-02-15
Scope: Add semantic checks for topology and layout consistency.

## File added

- `src/lib/preview/validateSampleGraphSemantic.ts`

## Checks implemented (v1)

1. `topology.nodes` must be non-empty.
- code: `SEMANTIC_TOPOLOGY_EMPTY`

2. Node ids must be valid.
- non-empty string ids
- unique ids
- code: `SEMANTIC_NODE_ID_INVALID`

3. Link endpoint integrity.
- each link `from` and `to` must exist in node id set
- code: `SEMANTIC_EDGE_REF_INVALID`

4. Layout coverage and coordinate validity.
- `layout.nodeWorld` required
- every node id must have finite `x` and `y`
- codes: `SEMANTIC_LAYOUT_NODEWORLD_MISSING`, `SEMANTIC_LAYOUT_COORD_INVALID`

## Output contract

- Returns `Result<void>` with aggregated errors.
- No preview wiring in this run yet (integration in later run).