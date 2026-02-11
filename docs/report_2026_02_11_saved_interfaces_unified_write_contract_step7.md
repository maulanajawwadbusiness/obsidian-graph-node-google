# Saved Interfaces Unified Write Contract (Step 7)

Date: 2026-02-11

## Scope

Unify saved interface mutations under one AppShell-owned commit pipeline so local state, local storage, and remote sync cannot diverge.

## Final Contract

Single writer surface in `src/screens/AppShell.tsx`:

1. `commitUpsertInterface(record, reason)`
2. `commitPatchLayoutByDocId(docId, layout, camera, reason)`
3. `commitRenameInterface(id, newTitle, reason)`
4. `commitDeleteInterface(id, reason)`
5. `commitHydrateMerge(merged)`

Shared behavior for commit paths:

1. Update in-memory list immediately (`savedInterfacesRef` + `setSavedInterfaces`).
2. Persist once through `saveAllSavedInterfaces(...)` on active namespace key.
3. Enqueue remote upsert/delete when authenticated.
4. Keep full payload intact (`parsedDocument.text`, full meta/warnings, topology, layout, camera, analysisMeta).
5. Keep ordering truth on payload timestamps (`record.updatedAt`), not DB row `updated_at`.

## Rewired Seams

### Analysis save

- Before:
  - `nodeBinding` wrote local storage directly via `upsertSavedInterface(...)`.
- After:
  - `nodeBinding` builds `SavedInterfaceRecordV1` and emits callback.
  - Graph forwards callback to AppShell.
  - AppShell runs `commitUpsertInterface(...)`.

Files:
- `src/document/nodeBinding.ts`
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `src/screens/AppShell.tsx`

### Layout patch

- Before:
  - Graph shell loaded local list and called `patchSavedInterfaceLayout(...)` directly.
- After:
  - Graph shell emits `onSavedInterfaceLayoutPatch(docId, layout, camera, reason)`.
  - AppShell runs `commitPatchLayoutByDocId(...)`.

Files:
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `src/screens/AppShell.tsx`

### Rename and delete

- Before:
  - AppShell called store patch/delete helpers that read-modify-write local storage directly.
- After:
  - AppShell uses commit paths (`commitRenameInterface`, `commitDeleteInterface`) and persists from in-memory list.

File:
- `src/screens/AppShell.tsx`

### Hydration merge

- Before:
  - hydrate effect merged then saved, then reloaded local storage.
- After:
  - hydrate effect merged then applies through `commitHydrateMerge(...)` (single persist path, no reload loop).

File:
- `src/screens/AppShell.tsx`

## Call Graph (Text)

Analysis run success
-> `applyAnalysisToNodes(...)` creates full record
-> Graph callback `onSavedInterfaceUpsert(record, "analysis_save")`
-> AppShell `commitUpsertInterface(...)`
-> state update + local persist
-> remote upsert enqueue (auth only)

Layout snapshot
-> Graph callback `onSavedInterfaceLayoutPatch(docId, layout, camera, "analysis_layout_patch")`
-> AppShell `commitPatchLayoutByDocId(...)`
-> state update + local persist
-> remote upsert enqueue (auth only)

Sidebar rename/delete
-> AppShell commit rename/delete
-> state update + local persist
-> remote mirror enqueue (auth only)

Identity hydrate
-> remote list + local list merge
-> AppShell `commitHydrateMerge(...)`
-> optional remote backfill enqueue

## Remaining Seams

1. `refreshSavedInterfaces()` still exists for mount and key-switch fallback loads.
2. Session-level hydration/backfill sets remain for strictmode duplicate suppression.
3. Remote queue remains serialized and guarded by identity epoch checks.

## Validation

- `npm run build` passed after step 7 rewiring.
