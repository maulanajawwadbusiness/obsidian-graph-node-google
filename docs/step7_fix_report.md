# Step 7 Fix Report (Deterministic Provider Layer)

Date: 2026-02-04

## Summary
Fixed determinism and observability issues in the Step 7 provider layer. The provider output is now stable across shuffled inputs, duplicate node ids are rejected deterministically, no-op applies do not bump topology version, and provider-side failures emit proper rejection events. ASCII-only usage is enforced via docs and small code corrections.

## Fixes Applied
- Deterministic hash: KGSpec input hash is now computed from a normalized and sorted spec (order-independent for nodes/links).
- Duplicate node ids: KGSpec provider rejects duplicates (order-independent) instead of keep-first dedupe.
- Stable link ordering: parallel edges with the same endpoints are sorted by a stable content hash before id assignment.
- No-op detection: provider apply compares normalized snapshots and emits a noop event without version bump.
- Provider errors: buildSnapshot failures now emit a rejection event with provider metadata.
- KG loader: provider rejection now short-circuits and does not report success.
- ManualMutationProvider: made side-effect free and patch-only (no hidden mutations inside buildSnapshot).
- Observer source: added topologyProvider to MutationSource.
- Stability test: removed Math.random by using a seeded deterministic shuffle.
- ASCII fix: replaced non-ASCII ellipsis in hash truncation.
- Cycle break: moved KGSpec conversion to a pure module to avoid provider registry import cycles.

## Files Touched
- src/graph/providers/KGSpecProvider.ts
- src/graph/providers/applyProvider.ts
- src/graph/providers/ManualMutationProvider.ts
- src/graph/providers/hashUtils.ts
- src/graph/providers/stabilityTest.ts
- src/graph/topologyControl.ts
- src/graph/topologyMutationObserver.ts
- src/graph/kgSpecToTopology.ts
- AGENTS.md
- docs/system.md
- docs/step7_fix_report.md

## Notes
- No UI changes.
- No HUD changes.
- Stability test run via esbuild bundle: PASS (5/5).
