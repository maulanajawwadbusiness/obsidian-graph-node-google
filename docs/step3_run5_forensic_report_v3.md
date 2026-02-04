# Step 3 Run 5 - Forensic Report v3 (Fix Required)

Date: 2026-02-04
Scope: Verify run-5 invariants for knowledge/physics split. This report lists current issues, locations, fix guidance, and expected results. Agent must fix all items below.

## Issues

1) Springs are cleared on every setTopology()
- Location: `src/graph/topologyControl.ts` (setTopology)
- Problem: setTopology() ignores provided springs and always stores `springs: []`. Any recompute done by callers is discarded immediately.
- Fix: Move spring recompute into the topology mutation seam (set/patch/clear) and ensure currentTopology.springs is always derived from currentTopology.links. Do NOT drop computed springs.
- Expected result: After setTopology() with links, `getTopology().springs.length` equals `deriveSpringEdges(links).length`.

2) KGSpec load recompute is nullified
- Location: `src/graph/kgSpecLoader.ts` (setTopologyFromKGSpec)
- Problem: recomputeSprings() is called, then setTopology() is called again, which clears springs.
- Fix: Remove the second setTopology() call or refactor to a single applyTopologyChange() that both sets links and recomputes springs atomically.
- Expected result: After KGSpec load, springs are present and consistent.

3) GraphPhysicsPlayground recompute is discarded in state
- Location: `src/playground/GraphPhysicsPlayground.tsx` (spawnGraph)
- Problem: recomputeSprings() returns a topology with springs, but setTopology() clears them. Any later getTopology() shows zero springs even when links exist.
- Fix: After fixing setTopology() to recompute internally, call setTopology() once with links; do not re-set or clear springs. Or use a dedicated topology mutator that recomputes.
- Expected result: `getTopology()` reflects correct springs after spawnGraph.

4) Springs are not recomputed on patchTopology() changes
- Location: `src/graph/topologyControl.ts` (patchTopology)
- Problem: patchTopology() only clears springs on mutations; it never recomputes. This violates the run-5 requirement for full coverage on add/remove/replace.
- Fix: Recompute springs within patchTopology() when links change (add/remove/set, or node removal). Use a version counter or link-hash to avoid redundant recompute.
- Expected result: After any patch that changes links, springs are updated in the same mutation.

5) Missing fallback-derive for XPBD when springs are empty
- Location: `src/graph/topologySpringRecompute.ts` / integration point
- Problem: Only a warning is logged if springs mismatch; there is no fallback to derive springs for XPBD when `springs` is empty but links exist.
- Fix: At the seam where XPBD consumes springs, if `springs` is empty and links exist, derive springs for that frame and log a loud warning. Ensure this does not create a recompute loop.
- Expected result: XPBD constraint count matches derived spring count even if springs state is stale.

## Expected Final Results (Must Verify)

- Knowledge layer remains directed: A?B and B?A are distinct in `topology.links`.
- Physics layer is undirected: only one spring exists for an unordered pair {A,B}.
- Springs are recomputed on EVERY links mutation path (set, patch, clear, KG load, node removal).
- XPBD consumes ONLY physics springs; never consumes directed links directly.
- If springs are missing but links exist, XPBD uses a fallback derived spring list for that frame and logs a warning.

## Agent Directive
Fix all items above with minimal diffs, console logs only (no HUD). Add dev-time proof logs for: directed link count, undirected spring count, and XPBD spring constraint count. Commit after run 6/8/10 per the plan once run 5 is complete.
