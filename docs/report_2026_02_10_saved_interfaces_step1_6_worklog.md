# Report: Saved Interfaces LocalStorage Worklog (Step 1-6)

Date: 2026-02-10
Scope: Local-only saved interfaces persistence and restore behavior.

## Summary
This report captures the implementation work completed so far for Steps 1-6 in this branch.

## Step 1: Layout Schema Support in Store
Status: Implemented

Files:
- `src/store/savedInterfacesStore.ts`

Work done:
- Added optional persisted fields on `SavedInterfaceRecordV1`:
  - `layout?: { nodeWorld: Record<string, { x: number; y: number }> }`
  - `camera?: { panX: number; panY: number; zoom: number }`
- Added runtime validators for optional `layout` and `camera` payloads.
- Added helper:
  - `patchSavedInterfaceLayout(id, layout, camera?)`
- Backward compatibility preserved for old records without layout/camera.

## Step 2: Capture Layout From Engine and Persist
Status: Implemented

Files:
- `src/playground/GraphPhysicsPlayground.tsx`

Work done:
- Added post-analysis capture path to snapshot engine world positions by node id.
- Added docId-based target resolution (`loadSavedInterfaces().find(r => r.docId === docId)`) and patch call to store.
- Captured camera snapshot values from current graph tracking state.
- Added one-shot guard by docId to avoid duplicate patch writes.

## Step 3: Apply Saved Layout and Camera on Restore
Status: Implemented

Files:
- `src/playground/useGraphRendering.ts`
- `src/playground/GraphPhysicsPlayground.tsx`

Work done:
- Added camera API from rendering hook:
  - `applyCameraSnapshot({ panX, panY, zoom })`
- In restore flow, applied saved positions by node id when layout exists.
- Gated legacy trig/circle fallback to only handle missing layout or missing node coordinates.
- Applied saved camera snapshot when present.

## Step 4: Prevent Post-Restore Relayout
Status: Not implemented in this branch as a dedicated hardening patch

Notes:
- A hardening plan was produced, but no separate Step 4 lock-window patch was merged yet.
- Current restore path already avoids circle overwrite when valid layout exists.

## Step 5: Legacy Records Compatibility
Status: Implemented

Files:
- `src/playground/GraphPhysicsPlayground.tsx`

Work done:
- Added explicit legacy-safe detection in restore:
  - `hasSavedLayoutMap`
  - `hasSavedCamera`
  - final apply condition `hasSavedLayout = hasSavedLayoutMap && nodesAppliedFromLayout > 0`
- If no valid saved layout data, restore uses legacy fallback and logs fallback path.
- If no valid saved camera, camera apply is skipped.
- Partial/malformed per-node coordinates are treated safely as fallback per node.

## Step 6: Status
Status: No additional Step 6 implementation landed in this branch beyond the completed restore and legacy compatibility changes above.

## Build Verification
- `npm run build` was run after each major implementation block and passed at latest state.

## Primary Files Updated Across This Work
- `src/store/savedInterfacesStore.ts`
- `src/document/nodeBinding.ts`
- `src/components/Sidebar.tsx`
- `src/screens/AppShell.tsx`
- `src/playground/useGraphRendering.ts`
- `src/playground/GraphPhysicsPlayground.tsx`
- `docs/report_2026_02_10_saved_interfaces_layout_shape_forensic.md`
- `docs/report_2026_02_10_sidebar_saved_interfaces_localstorage.md`
- `docs/report_2026_02_10_sidebar_saved_interfaces_step1_7_full.md`
