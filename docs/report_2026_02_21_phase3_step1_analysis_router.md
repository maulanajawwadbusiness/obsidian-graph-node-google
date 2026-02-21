# Phase 3 Step 1: Analysis Result Router

## Scope
- Create one frontend seam that owns analysis mode branching.
- Return tagged result shapes for classic and skeleton paths.
- Keep classic behavior unchanged and keep skeleton gated.

## Router Location
- `src/ai/analysisRouter.ts`
- Reason: AI request/parsing layer, no UI coupling, closest to existing analyzers.

## Current Invariants (Initial)
- Router decides mode through `resolveAnalyzeRequestMode()`.
- Classic path delegates to existing `analyzeDocument(...)`.
- `paperAnalyzer` now sends classic mode only and no longer resolves analysis mode itself.
- Skeleton path is routed through `analyzeDocumentToSkeletonV1(...)` only from router.
- Router maps skeleton gate failures to typed errors (`MODE_DISABLED`, `mode_guard_blocked`).
- No graph/topology wiring changes in this step.

## Runtime Call-Site Rule
- Runtime call-site switched to router at `src/document/nodeBinding.ts`.
- `nodeBinding` now handles tagged result union:
  - `kind: "classic"` -> existing binding path
  - `kind: "error"` or non-classic -> fail closed, classic flow remains safe
- Direct runtime import of `paperAnalyzer` from `nodeBinding` was removed.

## Phase 3 Follow-up Seam
- Next step can consume `kind: "skeleton_v1"` inside binding/topology flow.
- This step intentionally leaves that branch unused in runtime behavior.
