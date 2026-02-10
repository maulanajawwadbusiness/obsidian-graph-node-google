# Forensic Report: Saved Interfaces Restore Shape Regression

Date: 2026-02-10
Scope: Forensic scan only (no implementation)
Issue: Restored saved interfaces appear with the same node arrangement shape.

## Root Cause Summary
The restore path does not use any persisted node world positions. During restore, the code rebuilds node positions from topology using a deterministic circular layout (`angle = 2*pi*index/nodeCount`, then `x = cos(angle)*radius`, `y = sin(angle)*radius`) in `src/playground/GraphPhysicsPlayground.tsx:670-688`. Since saved data currently includes full `topology` and full `parsedDocument` but no `nodeId -> {x,y}` layout snapshot (`src/store/savedInterfacesStore.ts:9-28`, `src/graph/topologyTypes.ts:46-54`, `src/document/types.ts:6-18`), restore re-generates positions from node order and count, causing standardized/repeated shape.

## 1) What "shape" comes from today

### Fresh map path (analysis run)
1. Default graph is created first via `spawnGraph(4, 1337)` in `src/playground/GraphPhysicsPlayground.tsx:605`.
2. For `count === 4`, positions are hardcoded in `buildControlledGraph(...)`:
   - `n1..n4` with explicit `x/y` at `src/playground/GraphPhysicsPlayground.tsx:494-500`.
3. If not controlled mode, random graph positions come from seeded generator (`seed` arg) in `generateRandomGraph(...)` at `src/playground/graphRandom.ts:11-18`, using `SeededRandom` at `src/playground/graphRandom.ts:22-23`.
4. Analysis output (`paperAnalyzer`) contains only semantic points and links, no coordinates:
   - `AnalysisPoint` and `AnalysisLink` fields at `src/ai/paperAnalyzer.ts:16-34`.
   - structured schema fields only `paper_title`, `main_points`, `links` at `src/ai/paperAnalyzer.ts:50-54`, `src/ai/paperAnalyzer.ts:128-166`.
5. In `applyAnalysisToNodes(...)`, analysis updates labels/meta and topology links, but does not assign new `x/y`:
   - node set sorted by id at `src/document/nodeBinding.ts:64-65`
   - labels/meta applied at `src/document/nodeBinding.ts:88-101`
   - topology set at `src/document/nodeBinding.ts:137-140`
   - engine rewired using `nodesSnapshot = [...orderedNodes]` (keeps existing positions) at `src/document/nodeBinding.ts:148-152`.

Conclusion for fresh path:
- Shape is inherited from current engine node positions (spawned layout + physics evolution), not from analyzer output.

## 2) What is persisted in localStorage today

Saved record schema (`SavedInterfaceRecordV1`) includes:
- identity/display fields + full `parsedDocument` + full `topology` + preview + dedupe key
- see `src/store/savedInterfacesStore.ts:9-28`.

What is NOT in schema:
- no per-node world position fields (`x`, `y`)
- no velocity/camera snapshot fields

Topology contract confirms no position fields:
- `Topology.nodes: NodeSpec[]` with `id`, `label`, `meta` only at `src/graph/topologyTypes.ts:33-37`, `src/graph/topologyTypes.ts:46-54`.
- `setTopology` and `getTopology` copy only nodes/links/springs at `src/graph/topologyControl.ts:243-247` and `src/graph/topologyControl.ts:285-291`.

ParsedDocument confirms no layout fields:
- `id`, `fileName`, `mimeType`, `sourceType`, `text`, `warnings`, `meta` at `src/document/types.ts:6-18`.

Save trigger path proof:
- saved payload written in `applyAnalysisToNodes(...)` with `parsedDocument` and `topology` only at `src/document/nodeBinding.ts:194-207`.

Conclusion:
- Current persistence does not store any layout coordinates needed to restore original organic shape.

## 3) Restore path and where same shape is generated

Restore consume path:
1. AppShell sends selected saved record as pending intent:
   - set pending record on click at `src/screens/AppShell.tsx:277-281`
   - pass to graph props at `src/screens/AppShell.tsx:228-230`.
2. Graph restore effect consumes intent at `src/playground/GraphPhysicsPlayground.tsx:632-644`.
3. Restore order:
   - `setDocument(rec.parsedDocument)` at `src/playground/GraphPhysicsPlayground.tsx:651`
   - `setTopology(rec.topology, ...)` at `src/playground/GraphPhysicsPlayground.tsx:656`
   - derive springs/physics links at `src/playground/GraphPhysicsPlayground.tsx:657-661`
4. Position assignment during restore is recreated from index, not loaded from saved coordinates:
   - `angle = (2*pi*index)/nodeCount` at `src/playground/GraphPhysicsPlayground.tsx:671`
   - `x = cos(angle)*radius` at `src/playground/GraphPhysicsPlayground.tsx:687`
   - `y = sin(angle)*radius` at `src/playground/GraphPhysicsPlayground.tsx:688`
   - `radius` derived from count/config at `src/playground/GraphPhysicsPlayground.tsx:663-665`.
5. Those reconstructed nodes are injected into engine at `src/playground/GraphPhysicsPlayground.tsx:707-710`.

Determinism reason:
- `finalTopology.nodes.map((spec, index) => ...)` uses stable order from saved topology.
- On analysis save path, topology node order comes from `orderedNodes.sort((a,b)=>a.id.localeCompare(b.id))` at `src/document/nodeBinding.ts:64-65` and `topologyNodes` map at `src/document/nodeBinding.ts:128-135`.
- Same order + same formula => same restored geometric shape.

## 4) Hypothesis Check

Hypothesis: "If positions are not persisted, restore regenerates positions from topology using deterministic layout, producing identical shapes."

Result: CONFIRMED.
- No position persistence exists in saved schema (`src/store/savedInterfacesStore.ts:9-28`).
- Restore explicitly regenerates circular positions (`src/playground/GraphPhysicsPlayground.tsx:670-688`).

## 5) Exact Missing Data Needed to Preserve Shape

Minimum missing payload:
- `layoutByNodeId: Record<string, { x: number; y: number }>` in world coordinates.

Strongly recommended additional state for visual continuity:
- optional camera snapshot (`panX`, `panY`, `zoom`) if camera state is user-relevant.
- optional velocity/warmth if "resume motion state" is desired (not required for shape preservation).

Why this is required:
- Topology and parsedDocument currently represent semantics/content, not spatial arrangement.

## 6) Minimal Future Fix Outline (no code)

Capture point (save side):
1. At analysis success save trigger (`src/document/nodeBinding.ts:194-207`), include a layout snapshot sourced from current engine nodes by id before/at save.
2. Persist this layout snapshot alongside existing full `parsedDocument` and full `topology`.

Apply point (restore side):
1. In restore effect (`src/playground/GraphPhysicsPlayground.tsx:632-735`), when building `restoredNodes`, first try saved `layoutByNodeId[id]`.
2. Only fallback to current circular formula (`cos/sin`) for nodes missing saved coordinates.
3. Keep seam usage unchanged (`setTopology` remains source of truth for topology semantics).

## 7) Manual Verification Checklist (for later fix validation)

1. Create Map A, drag dots into a unique asymmetrical shape, save.
2. Create Map B, drag into clearly different shape, save.
3. Click A then B then A repeatedly from Sidebar.
4. Verify restored positions match each saved shape exactly (not standardized circle/template).
5. Refresh app and repeat step 3 to confirm persisted layout survives reload.
6. Verify node content/title/summary still restore correctly.
7. Verify restore still goes through `setTopology` seam and no pointer/input regressions occur in Sidebar.
8. Verify fallback behavior for missing layout data still works (legacy records restore with deterministic fallback, new records restore exact shape).

## Step 1 (Layout Schema) Implemented

Implemented file:
- `src/store/savedInterfacesStore.ts`

Added optional schema fields (backward compatible):
- `layout?: { nodeWorld: Record<string, { x: number; y: number }> }`
- `camera?: { panX: number; panY: number; zoom: number }`

Helper added:
- `patchSavedInterfaceLayout(id, layout, camera?)`
- Behavior:
  - loads current list
  - finds record by `id`
  - updates `layout` and optional `camera`
  - sets `updatedAt = Date.now()`
  - saves via existing store path (same quota-safe behavior)
  - returns updated newest-first list

Backward compatibility note:
- New fields are optional and runtime-validated only when present.
- Existing saved records without `layout` and `camera` remain loadable.

## Step 2 (Capture Layout From Engine) Implemented

Implemented file:
- `src/playground/GraphPhysicsPlayground.tsx`

Target record identity resolution:
- Chosen approach: resolve by `docId` from localStorage, then patch by resolved record `id`.
- Implementation reads `loadSavedInterfaces()` and finds the newest match for `docId` (list is newest-first by store contract), then calls `patchSavedInterfaceLayout(target.id, ...)`.
- This avoids changing `nodeBinding` save API and keeps diffs local to graph.

Snapshot source and timing:
- Snapshot is captured from ENGINE nodes (not analyzer output, not topology):
  - iterate `engine.nodes.values()` and persist `nodeWorld[node.id] = { x, y }`.
- Trigger point is after analysis success (`await applyAnalysisToNodes(...)`) in graph's text/file analysis success paths.
- No patch call is executed on error branches.

One-shot guard:
- A doc-scoped guard (`lastLayoutPatchedDocIdRef`) prevents duplicate patching for the same `docId` (StrictMode-safe intent).
- If target record id cannot be resolved, patch is skipped with calm log:
  - `[savedInterfaces] layout_patch_skipped reason=no_target_id`

Camera fields captured:
- Captured fields: `{ panX, panY, zoom }`.
- Current source in this step: `hoverStateRef.current.lastSelectionPanX`, `lastSelectionPanY`, `lastSelectionZoom`.
- These are numeric camera snapshots tracked by rendering/hover pipeline and stored as floats.

## Step 3 (Apply Layout On Restore) Implemented

Implemented files:
- `src/playground/useGraphRendering.ts`
- `src/playground/GraphPhysicsPlayground.tsx`

New camera API shape:
- `useGraphRendering(...)` now exposes:
  - `applyCameraSnapshot({ panX, panY, zoom })`
- API anchor:
  - function definition: `src/playground/useGraphRendering.ts:220`
  - returned from hook: `src/playground/useGraphRendering.ts:258`
- Behavior:
  - applies pan/zoom to current and target camera fields
  - syncs last-safe camera snapshot to avoid jitter/NaN fallback snaps
  - updates hover camera snapshot fields

Restore camera apply location:
- Camera snapshot is applied during restore when `rec.camera` exists:
  - `src/playground/GraphPhysicsPlayground.tsx:767`

Restore node position apply location:
- Layout map read:
  - `src/playground/GraphPhysicsPlayground.tsx:712`
- Per-node saved position lookup by id:
  - `src/playground/GraphPhysicsPlayground.tsx:733`
- Saved position assignment (fallback only if missing):
  - `src/playground/GraphPhysicsPlayground.tsx:745`
  - `src/playground/GraphPhysicsPlayground.tsx:746`

Circle fallback gating:
- Fallback trig path is now gated by layout presence.
- If layout exists, saved positions are applied and logged:
  - `[graph] layout_applied id=... nodesApplied=... zoom=...`
  - log anchor: `src/playground/GraphPhysicsPlayground.tsx:773`
- If layout is missing (legacy records), restore uses previous fallback behavior and logs:
  - `[graph] layout_missing_fallback id=...`
  - log anchor: `src/playground/GraphPhysicsPlayground.tsx:779`

Legacy behavior:
- Records without `layout` continue to restore via deterministic fallback layout.
- Records with `layout.nodeWorld` restore world positions by node id, preserving saved shape.

## Step 5 (Legacy Records Compatibility) Implemented

Implemented file:
- `src/playground/GraphPhysicsPlayground.tsx`

Detection rules in restore effect:
- `hasSavedLayoutMap`: `rec.layout?.nodeWorld` exists and has keys.
- `hasSavedCamera`: `rec.camera` exists and all camera numbers are finite (`panX`, `panY`, `zoom`).
- Final layout-apply decision is strict:
  - `hasSavedLayout = hasSavedLayoutMap && nodesAppliedFromLayout > 0`
  - this treats partial/malformed coordinate payloads as legacy fallback.

Fallback behavior for legacy records:
- If `!hasSavedLayout`, restore uses the existing circle fallback path.
- Fallback log remains:
  - `[graph] layout_missing_fallback id=...`
- No camera snapshot apply is attempted when `!hasSavedCamera`.

Malformed layout edge handling:
- Per-node coordinates are only applied when both `x` and `y` are finite.
- Invalid/missing node coordinates do not crash restore; they use fallback coordinates.
- If no valid saved node coordinates are applied (`nodesAppliedFromLayout === 0`), the whole restore is treated as legacy fallback for predictable behavior.

Store validation compatibility note:
- `loadSavedInterfaces` already allows missing `layout` and missing `camera` because these fields are optional and only validated when present (`src/store/savedInterfacesStore.ts` runtime guards).

Upgrade-on-open:
- Not added in this step to avoid unintended write spam during repeated restores.
