# Step 3 Hardening Run 5: Strict Dev-Export Parser (Preview Path)

Date: 2026-02-15
Scope: Add stronger dev-export validation with explicit path-level errors.

## File added

- `src/lib/devExport/parseDevInterfaceExportStrict.ts`

## What it validates

1. Root object shape
- error: `DEV_EXPORT_NOT_OBJECT`

2. Core metadata
- `version === 1` -> `DEV_EXPORT_VERSION_UNSUPPORTED`
- finite `exportedAt` -> `DEV_EXPORT_EXPORTED_AT_INVALID`
- non-empty `title` -> `DEV_EXPORT_TITLE_INVALID`

3. Critical payload presence
- required `topology` object -> `DEV_EXPORT_TOPOLOGY_MISSING`
- required array fields `topology.nodes` and `topology.links` -> `DEV_EXPORT_TOPOLOGY_INVALID`
- required `layout.nodeWorld` object -> `DEV_EXPORT_LAYOUT_INVALID`
- required `camera` object with finite `panX/panY/zoom` -> `DEV_EXPORT_CAMERA_INVALID`

## Notes

- Existing `parseDevInterfaceExportV1(...)` remains unchanged for compatibility.
- Strict parser returns `Result<DevInterfaceExportV1>` and is intended for preview hardening pipeline.