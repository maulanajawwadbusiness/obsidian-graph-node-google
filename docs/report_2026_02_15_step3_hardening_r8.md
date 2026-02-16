# Step 3 Hardening Run 8: Semantic Validator v2 (Camera + Analysis Meta)

Date: 2026-02-15
Scope: Extend semantic validator with UI-critical camera and metadata checks.

## File updated

- `src/lib/preview/validateSampleGraphSemantic.ts`

## Added checks

1. Camera sanity
- camera panX/panY/zoom must be finite numbers
- zoom range sanity: `(0, 20]`
- code: `SEMANTIC_CAMERA_INVALID`

2. Analysis metadata relation check
- when `analysisMeta.nodesById` exists, every key must exist in topology node ids
- code: `SEMANTIC_ANALYSIS_META_MISMATCH`

## Rationale

- Prevent malformed camera from causing unusable preview state.
- Prevent metadata-key drift from silently slipping into runtime path.