# Forensic Report: Node Popup Analysis Missing After Restore

Date: 2026-02-10
Mode: Forensic only (no implementation)
Severity: High (sacred analyzer payload lost on restore)

## Root Cause Summary
After restore, node popup body reads from engine node meta (`sourceSummary`), but restore rebuilds engine nodes from saved topology node meta that no longer contains analyzer summary text. In the save path, analyzer output is written to runtime engine node meta, then topology is rebuilt with `meta: { role }` only, dropping `sourceTitle/sourceSummary`. On restore, missing summary triggers fallback text `Saved interface: <title>`, producing empty/wrong popup bodies.

## 1) Literal String Trace: "Saved interface:"

Search result:
- `src/playground/GraphPhysicsPlayground.tsx:729`
  - `const fallbackSummary = `Saved interface: ${fallbackTitle}`;`

Where this reaches popup body:
- Restore builder uses fallback when no saved summary:
  - `src/playground/GraphPhysicsPlayground.tsx:753-755`
- Engine node meta is then set with `sourceSummary`:
  - `src/playground/GraphPhysicsPlayground.tsx:782-786`
- Popup opens using node meta:
  - `src/playground/GraphPhysicsPlayground.tsx:367-370`
- Popup renders content summary as body:
  - `src/popup/NodePopup.tsx:211-213`, `src/popup/NodePopup.tsx:423-425`

## 2) Node Popup Data Contract (Source of Truth)

Popup contract types:
- `content?: { title: string; summary: string }`
  - `src/popup/popupTypes.ts:31-35`
- `openPopup(..., content?)`
  - `src/popup/popupTypes.ts:39`
  - `src/popup/PopupStore.tsx:26-39`

Render behavior:
- title from `content.title` fallback node id text:
  - `src/popup/NodePopup.tsx:211`
- body from `content.summary` fallback i18n summary:
  - `src/popup/NodePopup.tsx:212`

Actual caller wiring:
- popup content comes from `node.meta.sourceTitle/sourceSummary`:
  - `src/playground/GraphPhysicsPlayground.tsx:367-370`

Conclusion:
- Real popup body source is `engine.nodes[nodeId].meta.sourceSummary` at click time.

## 3) Fresh Analysis vs Restore Pipeline

### A) Fresh Analysis Path (works)
1. Analyzer output includes `points[].summary`:
   - `src/ai/paperAnalyzer.ts:16-20`, `src/ai/paperAnalyzer.ts:239-243`
2. `applyAnalysisToNodes` writes analyzer text to runtime engine node meta:
   - `src/document/nodeBinding.ts:93-98`
3. Engine is rebuilt from `nodesSnapshot` (preserves runtime node meta):
   - `src/document/nodeBinding.ts:148-152`
4. Popup uses runtime node meta summary:
   - `src/playground/GraphPhysicsPlayground.tsx:367-370`

Last safe point with correct popup payload:
- After `node.meta.sourceSummary = point.summary` in `src/document/nodeBinding.ts:94-98` and before/through `engine.addNode(n)` using snapshot in `src/document/nodeBinding.ts:148-152`.

### B) Restore Path (broken)
1. AppShell click sets restore intent; graph consumes pending load:
   - `src/screens/AppShell.tsx:282-289`
   - `src/playground/GraphPhysicsPlayground.tsx:695-706`
2. Graph restore applies `rec.topology` via topology seam:
   - `src/playground/GraphPhysicsPlayground.tsx:718-719`
3. Graph rebuilds engine nodes from topology node specs and meta:
   - `src/playground/GraphPhysicsPlayground.tsx:741-788`
4. If `spec.meta.sourceSummary` missing, fallback is used:
   - `src/playground/GraphPhysicsPlayground.tsx:729`, `src/playground/GraphPhysicsPlayground.tsx:753-755`

Broken pipe location:
- Topology node meta created with role only:
  - `src/document/nodeBinding.ts:128-134`
- This drops analyzer fields and becomes saved topology payload:
  - `src/document/nodeBinding.ts:142` and upsert `topology: finalTopology` at `src/document/nodeBinding.ts:204`

## 4) What Was Actually Saved

Saved record schema supports full topology and optional analysisMeta:
- `SavedInterfaceRecordV1.topology`: `src/store/savedInterfacesStore.ts:19`
- `SavedInterfaceRecordV1.analysisMeta?`: `src/store/savedInterfacesStore.ts:20`

Actual save payload in success path:
- `upsertSavedInterface({... parsedDocument, topology, preview, dedupeKey ...})`
  - `src/document/nodeBinding.ts:194-207`
- No `analysisMeta` is provided here.

Critical detail:
- Saved `topology.nodes[].meta` is already reduced to `{ role }` by construction:
  - `src/document/nodeBinding.ts:133`

Therefore:
- Per-node analyzer summary text is not present in saved topology.
- `analysisMeta` is not used as fallback storage.

## 5) Missing vs Overwritten Data

Missing from persistence:
- Node-level analyzer fields used by popup:
  - `sourceTitle`
  - `sourceSummary`

Overwritten/fallback at restore:
- Missing summary replaced by `Saved interface: <title>`:
  - `src/playground/GraphPhysicsPlayground.tsx:729`, `src/playground/GraphPhysicsPlayground.tsx:753-755`

## 6) Fix Options (No Implementation)

### Option A (Recommended): Persist and restore exact popup payload as nodeId-keyed map
- Save `analysisMeta` as `{ [nodeId]: { sourceTitle, sourceSummary } }` at analysis success.
- Restore path applies this map to engine node meta after topology apply.
Pros:
- Explicit, resilient to topology meta normalization.
- Preserves sacred original analyzer text exactly.
Cons:
- Adds one more persisted structure to maintain.

### Option B (Smallest code diff): Carry popup fields in topology node meta end-to-end
- In `src/document/nodeBinding.ts:128-134`, include `sourceTitle/sourceSummary` in `topologyNodes[].meta` (not only role).
- Restore path already reads these fields (`src/playground/GraphPhysicsPlayground.tsx:750-755`), so fallback no longer wins.
Pros:
- Minimal diff and uses existing restore reader.
- No re-analysis required.
Cons:
- Couples popup payload to topology meta shape.

### Option C (Last resort, not recommended): Re-run analyzer on restore
Pros:
- Can regenerate missing summaries.
Cons:
- Violates sacred-original requirement (non-deterministic drift, latency, cost, offline failure).
- Should be avoided.

## Recommended Path

Choose Option B first (smallest safe fix), and only add Option A if future features need dedicated analysis payload versioning.

## Minimal Post-Fix Validation Checklist

1. Analyze a document and open node popup on graph before saving; record body text.
2. Save session and restore from sidebar.
3. Open same node popup; body text must match original analyzer summary (not `Saved interface: ...`).
4. Verify another node with non-empty summary also restores correctly.
5. Confirm no analyzer request is fired during restore.
