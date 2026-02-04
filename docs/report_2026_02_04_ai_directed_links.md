# Report: AI Directed Links Wiring

Date: 2026-02-04
Scope: AI analyzer now emits directed links and the graph applies them through topology control.

## Summary
- Updated the analyzer prompt and schema to require directed links in addition to point titles and summaries.
- Wired analysis output to topology control and physics link rebuild so AI can shape the map.
- Documented the new analyzer output contract in system docs.

## Files Changed
- src/ai/paperAnalyzer.ts
- src/document/nodeBinding.ts
- docs/system.md

## Behavior Notes
- Analyzer output now includes `links` using 0-based point indices.
- Node binding maps indices to live dot IDs, applies labels, and rebuilds links via setTopology plus derived springs.
- Invalid links (out of range or self loops) are dropped.

## Manual Verification
- Upload a document.
- Watch logs: `[AI] Applied X analysis points` and `[AI] Applied Y directed links`.
- Confirm links on screen match analyzer intent.

## Risks
- If the AI outputs malformed indices, links are dropped and the graph may appear sparse.
- If node count changes during analysis, stale results are discarded by docId guard.
