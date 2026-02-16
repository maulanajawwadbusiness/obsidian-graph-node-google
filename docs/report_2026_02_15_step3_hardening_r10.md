# Step 3 Hardening Run 10: Explicit Empty-Topology Guardrail

Date: 2026-02-15
Scope: Make non-empty topology requirement explicit and configurable in preview validator.

## File updated

- `src/lib/preview/validateSampleGraphSemantic.ts`

## Added policy constant

- `SAMPLE_PREVIEW_REQUIRE_NONEMPTY_TOPOLOGY = true`

## Behavior

- Empty topology now fails through explicit policy gate (not implicit side effect).
- Failure code remains `SEMANTIC_TOPOLOGY_EMPTY`.

## Result

- No valid path remains where preview runtime mounts with empty topology when this policy is true.