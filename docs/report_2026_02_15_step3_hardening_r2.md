# Step 3 Hardening Run 2: Error Model and Canonical Result Pipeline

Date: 2026-02-15
Scope: Design-only lock for strict preview validation flow.

## Result model

Proposed shared types:
1. `ValidationError`
- shape: `{ code: string; message: string; path?: string }`

2. `Result<T>`
- success: `{ ok: true; value: T }`
- failure: `{ ok: false; errors: ValidationError[] }`

## Canonical preview pipeline (single path)

1. `parseDevExportStrict(unknown) -> Result<DevInterfaceExportV1>`
2. `devExportToSavedInterfaceRecordStrict(dev, opts) -> Result<SavedInterfaceRecordV1>`
3. `parseSavedInterfaceRecordForPreview(record) -> Result<SavedInterfaceRecordV1>`
4. `validateSampleGraphSemantic(record) -> Result<void>`
5. Mount runtime only if every stage is `ok: true`.

Fail policy:
- any failed stage returns explicit errors.
- preview must render error UI and not mount `GraphPhysicsPlayground`.

## Error code set (initial)

1. `DEV_EXPORT_NOT_OBJECT`
2. `DEV_EXPORT_VERSION_UNSUPPORTED`
3. `DEV_EXPORT_EXPORTED_AT_INVALID`
4. `DEV_EXPORT_TITLE_INVALID`
5. `DEV_EXPORT_TOPOLOGY_MISSING`
6. `DEV_EXPORT_TOPOLOGY_INVALID`
7. `DEV_EXPORT_LAYOUT_INVALID`
8. `DEV_EXPORT_CAMERA_INVALID`
9. `ADAPTER_TOPOLOGY_REJECTED`
10. `SAVED_RECORD_PARSE_FAILED`
11. `SEMANTIC_TOPOLOGY_EMPTY`
12. `SEMANTIC_NODE_ID_INVALID`
13. `SEMANTIC_EDGE_REF_INVALID`
14. `SEMANTIC_LAYOUT_NODEWORLD_MISSING`
15. `SEMANTIC_LAYOUT_COORD_INVALID`
16. `SEMANTIC_CAMERA_INVALID`
17. `SEMANTIC_ANALYSIS_META_MISMATCH`

## UX behavior contract

Inside preview box only:
- title: `sample graph invalid`
- show first 3 errors (`code` + short text)
- show overflow indicator `+N more`
- no runtime mount when invalid

## Compatibility constraints

1. Keep `parseSavedInterfaceRecord(...)` global behavior unchanged for non-preview flows.
2. Add preview-only wrappers; do not alter shared saved-interface sync semantics.
3. Keep step 4 lease path intact.