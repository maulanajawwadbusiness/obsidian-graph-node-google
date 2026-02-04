# Step 3 Run 5 - Forensic Report (Additional Issues)

Date: 2026-02-04
Scope: Directed knowledge vs undirected physics split (step 3), review for additional issues beyond the reported must-fix list.

## Findings

1) Springs can include invalid endpoints or self-loops
- File: `src/graph/springDerivation.ts`
- The derivation loop does not skip self-loops or links whose endpoints are missing from `topology.nodes`.
- Consequence: `SpringEdge` entries can be created for invalid pairs, and `engine.addLink()` does not verify node existence (`src/physics/engine/engineTopology.ts`). This can introduce adjacency entries and XPBD constraints for non-existent dots.
- Impact: Violates the Run 3 requirement and can destabilize physics or make constraints inconsistent.

2) Missing rel is not defaulted at load time
- File: `src/graph/kgSpecLoader.ts` (function `kgLinkToDirectedLink`)
- `kind` is set directly from `link.rel` and may remain undefined when rel is missing.
- Requirement says missing rel must become a default string; current default is only applied on export (`exportTopologyAsKGSpec` uses `link.kind || 'relates'`).
- Impact: Internal code paths that rely on `kind` or future link semantics may see undefined.

3) Rest-length policy logs produce Infinity/NaN when no springs
- File: `src/graph/restLengthPolicy.ts`
- If `springEdges.length === 0`, the min/max/avg computation uses Math.min/Math.max on an empty array.
- Result: Console logs show `min=Infinity`, `max=-Infinity`, `avg=NaN`.
- Impact: Not a functional break, but it creates misleading diagnostics and makes perf or correctness logs noisy.

4) External callers can inject stale or inconsistent springs
- File: `src/graph/topologyControl.ts` (setTopology), `src/graph/topologyTypes.ts`
- `setTopology` copies `topology.springs` as provided without validating against `topology.links`.
- If a caller sets `topology.springs` directly (or passes a stale copy), the stored springs can diverge silently.
- Impact: XPBD can consume inconsistent spring lists, violating the knowledge/physics split invariants.

## Context Notes
- `setTopologyFromKGSpec()` in `src/graph/kgSpecLoader.ts` calls `setTopology()` directly and does not recompute springs; if a previous topology had springs, they persist unless overwritten elsewhere.
- `patchTopology()` mutates links and nodes without touching springs, so springs can reference removed dots after node removals.

## Suggested Follow-up (Non-Blocking)
- Add endpoint existence and self-loop checks in spring derivation.
- Default `link.rel` (e.g., `rel || 'related'`) at import to satisfy the hard constraint.
- Guard rest-length policy logs for empty spring lists.
- Enforce a single recompute seam so `springs` is derived and validated, never provided directly.
