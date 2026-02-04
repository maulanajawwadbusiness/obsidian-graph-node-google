# Step 3 Run 5 - Forensic Report v6 (Fix Required)

Date: 2026-02-04
Scope: Verify run-5 invariants for knowledge/physics split. This report lists current issues, locations, fix guidance, expected results, and directive to fix.

## Issues

1) Hardcoded rest-length config diverges from actual defaults
- Location: `src/graph/kgSpecLoader.ts`, `src/graph/devTopologyHelpers.ts`
- Problem: Calls now pass `{ targetSpacing: 200 }`, which does NOT match the real default policy (`DEFAULT_PHYSICS_CONFIG.targetSpacing` is `300 * EDGE_LEN_SCALE`). This silently changes rest lengths for KG loads and dev mutations.
- Fix: Use the real default config (import `DEFAULT_PHYSICS_CONFIG` or a shared `getDefaultSpringConfig()` helper), or move rest-length application to the physics conversion step where config is always known.
- Expected result: KG loads and dev mutations use the same rest-length policy as the engine defaults.

2) Type-safety regression for config
- Location: `src/graph/topologyControl.ts`
- Problem: `setTopology()` and `patchTopology()` accept `config?: any`. This loses type safety and allows incorrect config to pass silently.
- Fix: Change to `config?: ForceConfig` or `Partial<ForceConfig>` (and import the type). If defaults are used, merge with defaults explicitly.
- Expected result: TypeScript enforces correct config usage and prevents silent misconfig.

3) Rest-length policy still depends on every caller passing config
- Location: `src/graph/topologyControl.ts`
- Problem: If any caller omits `config`, `deriveSpringEdges()` runs without rest-length policy, producing undefined `restLen` values.
- Fix: Provide an internal default config in `setTopology()`/`patchTopology()` or move rest-length assignment to `springEdgesToPhysicsLinks()` (where config is always available).
- Expected result: Springs used by XPBD always include policy-computed rest lengths, regardless of caller.

## Expected Final Results (Must Verify)

- Knowledge layer remains directed: A?B and B?A are distinct in `topology.links`.
- Physics layer is undirected: only one spring exists for an unordered pair {A,B}.
- Springs are recomputed on EVERY links mutation path (set, patch, clear, KG load, node removal).
- XPBD consumes ONLY physics springs; never consumes directed links directly.
- Rest-length policy is preserved for all mutation paths and matches default engine settings.
- Type safety preserved for topology mutation APIs.

## Agent Directive
Fix all items above with minimal diffs and console logs only (no HUD). Keep the run plan: commit after run 6/8/10 once run 5 is complete.
