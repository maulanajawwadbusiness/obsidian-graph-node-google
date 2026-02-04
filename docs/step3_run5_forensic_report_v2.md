# Step 3 Run 5 - Forensic Report v2 (All Known Issues + Fix Directives)

Date: 2026-02-04
Scope: Directed knowledge vs undirected physics split (step 3). This file consolidates ALL known issues (user-reported + newly found) and explicitly directs the agent to fix them.

## Issues To Fix (All Known)

1) Run-5 report completeness missing
- Problem: `docs/step3_knowledge_physics_split_log.md` claims runs 1-5 but only contains runs 1-4.
- Fix: Add a Run 5 section with what changed and console proof.

2) Springs recompute coverage is incomplete (critical)
- Problem: Springs are only recomputed via the GraphPhysicsPlayground path. Any other topology mutations (patch/remove/clear/load) can leave stale springs.
- Fix: Recompute springs on ALL topology link mutations (add/remove/replace/clear/load/filter-on-node-remove), preferably inside topologyControl or a single applyTopologyChange seam.

3) Dev-time invariant checks missing
- Problem: No assertion that `springs` matches a fresh derive from `links`.
- Fix: Add DEV-only assertion/log: `springs.length === deriveSpringEdges(links).length` and optional key/hash match. If mismatch, fallback-derive for XPBD for that frame and emit a loud warning.

4) Semantic rule confirmation
- Problem: Not verified across all mutation paths.
- Fix: Ensure any directed link between A/B yields exactly one spring; removing last directed link removes the spring; A?B + B?A must remain a single spring.

5) Performance sanity
- Problem: Recompute may be too frequent or cause repeated setState churn.
- Fix: Recompute only when links change (version counter or stable memo), avoid recompute loops.

6) Spring derivation does NOT skip invalid endpoints or self-loops
- Problem: `deriveSpringEdges` currently accepts any link; does not check for self-loops or missing nodes.
- Fix: Skip self-loops and links whose endpoints are missing from topology.nodes.

7) Missing rel defaulting at load time
- Problem: `kgLinkToDirectedLink` maps `rel` to `kind` without default; `kind` can be undefined.
- Fix: Default missing rel to a string (e.g., "related") on import so internal semantics never see undefined.

8) Rest-length policy logs misleading when no springs
- Problem: `computeRestLengths` logs min/max/avg using empty arrays, yielding Infinity/NaN.
- Fix: Guard logs when length is 0 to avoid noisy/incorrect diagnostics.

9) External callers can inject stale springs
- Problem: `setTopology` copies `topology.springs` directly without validation.
- Fix: Treat springs as derived-only; recompute and ignore external springs, or validate/override them on set/patch.

10) Springs not cleared/updated after node removal
- Problem: `patchTopology` removes nodes and related links but leaves springs unchanged, which can still reference removed nodes.
- Fix: Recompute springs after node removals and link mutations.

11) KGSpec load path does not derive springs
- Problem: `setTopologyFromKGSpec` calls `setTopology` with links only. Springs remain empty or stale.
- Fix: Ensure KG load recomputes springs so XPBD consumes the correct physics layer.

## Agent Directive
- Fix ALL issues above before proceeding to runs 6-10.
- Keep diffs minimal; no HUD changes.
- Add dev-only console proofs for directed vs undirected counts and XPBD constraint counts.
- Follow run plan: commit every 2 runs after run 6/8/10 once run 5 is complete.
