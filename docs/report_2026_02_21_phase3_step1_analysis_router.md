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
- Skeleton path is intentionally blocked in step-1 scaffold and returns typed error.
- No graph/topology wiring changes in this step.
