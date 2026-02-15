# Report: Sample Preview Adapter Run 1

Date: 2026-02-15  
Scope: forensic mapping of canonical restore contract for preview sample JSON.

## Canonical Contract Anchors

### SavedInterfaceRecordV1 shape
- `src/store/savedInterfacesStore.ts:20`
- Required fields:
  - `id`, `createdAt`, `updatedAt`, `title`, `docId`, `source`, `parsedDocument`, `topology`, `preview`, `dedupeKey`
- Optional fields:
  - `fileName`, `mimeType`, `analysisMeta`, `layout`, `camera`

### Parser behavior
- `src/store/savedInterfacesStore.ts:167`
- `parseSavedInterfaceRecord(value)` returns `SavedInterfaceRecordV1 | null`
- It does not throw by contract; invalid payload returns `null`.
- `analysisMeta` is sanitized and dropped if invalid (`src/store/savedInterfacesStore.ts:157-164`).

### pendingLoadInterface contract
- Prop type is full record: `src/playground/GraphPhysicsPlaygroundShell.tsx:57`
- Consume path:
  - restore intent tracking: `src/playground/GraphPhysicsPlaygroundShell.tsx:755-759`
  - default spawn gate depends on pending restore: `src/playground/GraphPhysicsPlaygroundShell.tsx:775-790`
  - restore effect consume entry: `src/playground/GraphPhysicsPlaygroundShell.tsx:800-813`
  - restore application begins: `src/playground/GraphPhysicsPlaygroundShell.tsx:820+`
- Important behavior:
  - if `pendingLoadInterface` is absent at first init, default seed spawn runs (`spawnGraph(4,1337)`).
  - to avoid seed graph in preview, sample record must be ready before runtime mount.

## Dev Export Shape Anchor

- Current dev export type (local-only in shell): `src/playground/GraphPhysicsPlaygroundShell.tsx:91`
- Shape: `version`, `exportedAt`, `title`, `parsedDocument`, `topology`, `layout`, `camera`, `analysisMeta`
- Missing versus `SavedInterfaceRecordV1`:
  - `id`, `createdAt`, `updatedAt`, `docId`, `source`, `preview`, `dedupeKey`

## Required vs Optional Fields (based on parser checks)

Required to pass parse:
1. `id: string`
2. `createdAt: number`
3. `updatedAt: number`
4. `title: string`
5. `docId: string`
6. `source: 'paste' | 'file' | 'unknown'`
7. `dedupeKey: string`
8. `parsedDocument` object with:
   - `text: string`
   - `warnings: array`
   - `meta: object`
9. `topology` object with:
   - `nodes: array`
   - `links: array`
10. `preview` object with finite numbers:
   - `nodeCount`, `linkCount`, `charCount`, `wordCount`

Optional in parser:
1. `analysisMeta` (must be valid shape if present, otherwise dropped)
2. `layout` (`nodeWorld` map)
3. `camera` (`panX`, `panY`, `zoom`)
4. `fileName`, `mimeType`

## Sample Location Decision

- Chosen location: `src/samples/`
- Reason:
  - under `src` (included by current tsconfig)
  - easy static import in preview module
  - keeps preview data local to frontend bundle without touching persistence paths

## Text Truncation Decision

- Current sample export files in `paper_sample_arnvoid/` are moderate size (largest around ~64KB).
- For this step, keep full text to preserve canonical payload fidelity.
- No truncation policy applied in run 1.
