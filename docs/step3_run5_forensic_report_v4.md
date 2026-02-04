# Step 3 Run 5 - Forensic Report v4 (Fix Required)

Date: 2026-02-04
Scope: Verify run-5 invariants for knowledge/physics split. This report lists current issues, locations, fix guidance, expected results, and directive to fix.

## Issues

1) Unused import errors (TypeScript strict)
- Location: `src/graph/kgSpecLoader.ts`, `src/playground/GraphPhysicsPlayground.tsx`
- Problem: `recomputeSprings` is imported but no longer used. With `noUnusedLocals: true`, this is a build error.
- Fix: Remove unused imports or use the helper if it remains part of the intended seam.
- Expected result: TypeScript build passes with no unused imports.

2) Rest-length policy regression
- Location: `src/graph/topologyControl.ts` (setTopology/patchTopology)
- Problem: Springs are recomputed via `deriveSpringEdges(currentTopology)` with no `config`, so `restLen` is no longer populated. This regresses the previous policy-based rest lengths.
- Fix: Either pass `config` into derivation at the seam (if available) OR move rest-length application into the physics conversion step so XPBD always receives lengths. Ensure behavior matches prior policy.
- Expected result: Derived springs used by XPBD include policy-computed `restLen` values, not undefined.

3) Dev invariant checks no longer executed
- Location: `src/graph/topologySpringRecompute.ts` vs `src/graph/topologyControl.ts`
- Problem: The mismatch check lives in `recomputeSprings()` but topology now recomputes internally without calling that helper, so the check never runs.
- Fix: Move or duplicate the invariant check into the topology mutation seam (set/patch) so it executes on actual state updates.
- Expected result: Dev-only mismatch warnings fire when springs diverge from links.

4) XPBD fallback derivation is scoped only to spawnGraph()
- Location: `src/playground/GraphPhysicsPlayground.tsx`
- Problem: Fallback-derive for missing springs only happens in the random graph spawn path. Other topology load/mutation flows that feed XPBD may not get the fallback.
- Fix: Ensure the XPBD link inventory uses a shared fallback path, or enforce springs consistency at the topology seam so fallback is not needed elsewhere.
- Expected result: XPBD constraint count always matches derived spring count whenever links exist, regardless of load path.

## Expected Final Results (Must Verify)

- Knowledge layer remains directed: A?B and B?A are distinct in `topology.links`.
- Physics layer is undirected: only one spring exists for an unordered pair {A,B}.
- Springs are recomputed on EVERY links mutation path (set, patch, clear, KG load, node removal).
- XPBD consumes ONLY physics springs; never consumes directed links directly.
- Rest-length policy is preserved (springs used by XPBD have computed `restLen`).
- If springs are missing but links exist, XPBD still uses a fallback derived spring list and logs a warning.

## Agent Directive
Fix all items above with minimal diffs and console logs only (no HUD). Keep the run plan: commit after run 6/8/10 once run 5 is complete.
