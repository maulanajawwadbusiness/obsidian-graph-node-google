# Phase 2 Skeleton Output Topology-First Report (2026-02-21)

## Scope

Phase 2 delivers robust `KnowledgeSkeletonV1` production path and safe seams.
This phase does not activate topology-first runtime binding yet.

Explicitly unchanged:
- classic undercurrent flow remains default
- index-slot binding path in `src/document/nodeBinding.ts` remains unchanged
- runtime spawn/topology activation policy remains unchanged

## Policy Updates

- orphan policy is now strict zero-orphan:
  - every node must have degree >= 1
- enforced in:
  - `src/server/src/llm/analyze/knowledgeSkeletonV1.ts`
  - frontend parser wrappers via shared validator import

## Endpoint/Mode Behavior

Route:
- `POST /api/llm/paper-analyze`

Mode contract:
- request `mode` supports:
  - `classic` (default)
  - `skeleton_v1`

Classic response unchanged:
- `{ ok: true, request_id, json }`

Skeleton response:
- `{ ok: true, request_id, mode: "skeleton_v1", skeleton }`

Skeleton error response:
- `{ ok: false, request_id, code, error, mode: "skeleton_v1", validation_errors }`

## Prompt Design Summary

Skeleton prompt module:
- `src/server/src/llm/analyze/skeletonPrompt.ts`

Prompt requirements include:
- nodes 3..12
- allowed node roles and edge types enums
- slug-like id guidance
- short text caps for label/summary/rationale
- no self loops
- no orphan nodes
- valid edge references

## Validation and Repair Loop

Skeleton analyzer module:
- `src/server/src/llm/analyze/skeletonAnalyze.ts`

Validation-first contract:
- every model output is passed through `validateKnowledgeSkeletonV1`

Repair loop behavior:
- initial generation + up to 2 repair attempts
- repair prompt includes:
  - invalid JSON (safe truncated)
  - typed validation errors (`code`, `path`, `message`)
  - strict corrected-JSON-only instruction
- on final failure:
  - returns `skeleton_output_invalid` with typed `validation_errors`

Providers:
- openrouter path uses text parse + validator + repair loop
- openai structured path uses schema + validator + repair loop for semantic failures

## Logging Flags

Server debug flag (local boolean, default off):
- `ENABLE_SKELETON_DEBUG_LOGS` in `src/server/src/llm/analyze/skeletonAnalyze.ts`
- logs raw output preview, validation errors, accepted skeleton summary

Frontend debug flag (local boolean, default off):
- `ENABLE_SKELETON_DEBUG_STORAGE` in `src/ai/skeletonAnalyzer.ts`
- writes latest skeleton to `window.__ARNVOID_SKELETON_DEBUG`
- logs compact summary (nodes, edges, top pressure node)

## Frontend Plumbing Seams (Disabled By Default)

Added but not UI-wired by default:
- `src/ai/skeletonAnalyzer.ts`
- `src/ai/analyzeMode.ts`

Current default selection:
- `resolveAnalyzeRequestMode()` returns `classic`
- `src/ai/paperAnalyzer.ts` now reads mode from this single seam

This keeps current app behavior unchanged while exposing controlled switchpoint.

## Golden Fixtures and Harness

Golden fixtures added:
- `docs/fixtures/knowledge_skeleton_v1_golden_3.json`
- `docs/fixtures/knowledge_skeleton_v1_golden_8.json`
- `docs/fixtures/knowledge_skeleton_v1_golden_12.json`

Quality checklist:
- `docs/knowledge_skeleton_quality_checklist.md`

Offline harness and tests:
- `src/server/scripts/test-knowledge-skeleton-golden-contracts.mjs`
- `src/server/scripts/run-knowledge-skeleton-harness.mjs`
- npm scripts:
  - `test:knowledge-skeleton-golden-contracts`
  - `test:knowledge-skeleton-harness`

## Phase 3 Consumption Seam

Phase 3 will consume validated skeleton output through:
- `src/graph/knowledgeSkeletonAdapter.ts`
- `src/server/src/llm/analyze/knowledgeSkeletonAdapter.ts`

Planned path (not activated in Phase 2):
- skeleton output -> `skeletonToTopology` -> topology mutation via `setTopology`

## Verification Snapshot

Phase 2 verification gates executed:
- root: `npm run build`
- server: `npm run build`
- server: `npm run test:contracts`
- server: `npm run test:knowledge-skeleton-harness`

All green at completion.
