# Step 3 Run 5 - Forensic Report v5 (Fix Required)

Date: 2026-02-04
Scope: Verify run-5 invariants for knowledge/physics split. This report lists current issues, locations, fix guidance, expected results, and directive to fix.

## Issues

1) KGSpec load path loses rest-length policy
- Location: `src/graph/kgSpecLoader.ts`
- Problem: `setTopology(topology)` is called without a config, so `deriveSpringEdges()` runs without rest-length policy; springs have undefined `restLen`.
- Fix: Pass a ForceConfig to `setTopology()` (or apply rest-length at physics-link conversion). Ensure KG load path preserves rest-length policy.
- Expected result: KG loads produce springs with policy-computed `restLen`.

2) devTopologyHelpers patch path skips rest-length policy
- Location: `src/graph/devTopologyHelpers.ts`
- Problem: `patchTopology()` calls do not pass a config, so spring rest lengths are not computed for dev mutations.
- Fix: Supply config to patchTopology() or move rest-length assignment to the physics conversion step. Ensure dev-only paths match production behavior.
- Expected result: Dev-added links produce springs with `restLen` populated by policy.

3) Dev invariant checks are too narrow
- Location: `src/graph/topologyControl.ts`
- Problem: The mismatch warning only runs when `topology.springs` is provided. It does not catch the case where `springs` is empty while `links` exist.
- Fix: Expand dev checks to assert `springs.length === deriveSpringEdges(links, config).length` regardless of provided springs; warn if springs are empty but links exist.
- Expected result: Dev logs flag any stale/missing springs, even when no springs were provided.

## Expected Final Results (Must Verify)

- Knowledge layer remains directed: A?B and B?A are distinct in `topology.links`.
- Physics layer is undirected: only one spring exists for an unordered pair {A,B}.
- Springs are recomputed on EVERY links mutation path (set, patch, clear, KG load, node removal).
- XPBD consumes ONLY physics springs; never consumes directed links directly.
- Rest-length policy is preserved for all mutation paths.
- Dev invariant warnings trigger if springs are missing while links exist.

## Agent Directive
Fix all items above with minimal diffs and console logs only (no HUD). Keep the run plan: commit after run 6/8/10 once run 5 is complete.
