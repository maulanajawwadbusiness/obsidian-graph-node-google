# Phase 2.5 Hardening Report (Audit Fixes Before Phase 3)

## Run 1: Strict Schema Enforcement (Unknown Fields Rejected)

Date: 2026-02-21

Changes made:
- Server shape validator now rejects unknown keys at every skeleton layer:
  - root: `nodes`, `edges` only
  - node: `role`, `id`, `label`, `summary`, `pressure`, `confidence` only
  - edge: `from`, `to`, `type`, `weight`, `rationale` only
- Error code used: `unknown_property` with explicit property path.
- Frontend parser strictness is aligned automatically because frontend parser imports and uses the same validator module.

Code anchors:
- `src/server/src/llm/analyze/knowledgeSkeletonV1.ts`
  - helper: `collectUnknownPropertyErrors(...)`
  - usage in `validateKnowledgeSkeletonV1Shape(...)` at root, node, and edge passes

Tests added:
- `src/server/scripts/test-knowledge-skeleton-contracts.mjs`
  - invalid root extra field
  - invalid node extra field
  - invalid edge extra field

Sample error payload shape:
```json
{
  "code": "unknown_property",
  "message": "unknown property: extra_node",
  "path": "nodes[0].extra_node"
}
```

## Run 2: OpenRouter Parse Error Repair Flow

Date: 2026-02-21

Changes made:
- OpenRouter path no longer exits immediately on JSON parse failure.
- Added tolerant extraction for model text outputs:
  - strips code fences when present
  - attempts balanced JSON object extraction
  - parses extracted object if valid
- Parse failures now enter repair loop (up to existing cap), then return typed `parse_error` only after retries are exhausted.
- Added parse-repair prompt builder with strict instructions:
  - return JSON only
  - no markdown fences
  - no prose wrappers

Code anchors:
- `src/server/src/llm/analyze/skeletonAnalyze.ts`
  - `extractFirstJsonObject(...)`
  - `stripCodeFences(...)`
  - `extractBalancedObject(...)`
  - OpenRouter loop logic in `analyzeDocumentToSkeletonV1(...)`
- `src/server/src/llm/analyze/skeletonPrompt.ts`
  - `buildSkeletonParseRepairInput(...)`

Tests added/updated:
- `src/server/scripts/test-knowledge-skeleton-analyze-contracts.mjs`
  - fenced JSON extraction
  - prose-wrapped JSON extraction
  - parse failure then successful repair
  - persistent parse failure returns `parse_error` after capped retries
- `src/server/scripts/test-knowledge-skeleton-prompt-contracts.mjs`
  - parse-repair prompt instructions validated

## Run 3: Prompt Constraint Alignment + Actionable Orphan Errors

Date: 2026-02-21

Changes made:
- Prompt now states hard edge cap formula explicitly:
  - `edges <= max(6, nodeCount * 2)`
- Orphan validation now includes explicit orphan ids to make repair instructions actionable.
- Validation error model now supports optional structured `details` payload.
- Repair message formatting now includes `details` payload so orphan ids are passed through repair prompts.

Code anchors:
- `src/server/src/llm/analyze/skeletonPrompt.ts`
  - edge-cap rule line in `buildCoreInstruction(...)`
- `src/server/src/llm/analyze/knowledgeSkeletonV1.ts`
  - `KnowledgeSkeletonValidationError.details`
  - orphan list construction in `validateKnowledgeSkeletonV1Semantic(...)`
- `src/server/src/llm/analyze/skeletonAnalyze.ts`
  - `toValidationMessages(...)` includes details serialization

Tests added/updated:
- `src/server/scripts/test-knowledge-skeleton-contracts.mjs`
  - orphan error now required to contain `details.orphan_ids`
- `src/server/scripts/test-knowledge-skeleton-prompt-contracts.mjs`
  - prompt includes explicit edge-cap formula
  - repair input preserves orphan ids

Example orphan error:
```json
{
  "code": "orphan_nodes_excessive",
  "message": "orphan nodes are not allowed: n-evidence",
  "path": "edges",
  "details": {
    "orphan_ids": ["n-evidence"]
  }
}
```

## Run 4: Repair Payload Caps + Logging Safety

Date: 2026-02-21

Changes made:
- Added hard caps for repair prompt payload components:
  - invalid JSON preview: 8000 chars
  - raw output preview: 2000 chars
  - document excerpt: 3000 chars
- Added head+tail truncation with explicit marker:
  - `...[truncated]...`
- Applied caps in:
  - initial analyze input document excerpt
  - validation-repair prompt payload
  - parse-repair prompt payload
- Debug logging kept default-off and now logs compact summary for accepted skeletons:
  - node count
  - edge count
  - top pressure node id
- Raw debug previews are now bounded by the raw preview cap.

Code anchors:
- `src/server/src/llm/analyze/skeletonPrompt.ts`
  - `SKELETON_PROMPT_LIMITS`
  - `trimWithHeadTail(...)`
  - capped usage in `buildSkeletonAnalyzeInput(...)`
  - capped usage in `buildSkeletonRepairInput(...)`
  - capped usage in `buildSkeletonParseRepairInput(...)`
- `src/server/src/llm/analyze/skeletonAnalyze.ts`
  - bounded `toDebugPreview(...)`
  - compact `toSkeletonSummary(...)`

Tests added:
- `src/server/scripts/test-knowledge-skeleton-repair-budget-contracts.mjs`
  - truncation marker + head/tail preservation
  - repair prompt length budget checks
  - cap constant drift checks
