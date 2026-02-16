# Report: Sample Preview Adapter Run 2

Date: 2026-02-15  
Scope: implement adapter from dev export shape to canonical `SavedInterfaceRecordV1`.

## Files Added

1. `src/lib/devExport/devExportTypes.ts`
2. `src/lib/devExport/devExportToSavedInterfaceRecord.ts`

## Added Modules

### Dev export types + parser
- `src/lib/devExport/devExportTypes.ts`
- Exports:
  - `DevInterfaceExportV1`
  - `parseDevInterfaceExportV1(value)`
- Parse behavior:
  - validates top-level shape and required primitive keys
  - returns `null` on invalid input

### Adapter
- `src/lib/devExport/devExportToSavedInterfaceRecord.ts`
- Exports:
  - `devExportToSavedInterfaceRecordV1(dev, opts?)`
- Output: full `SavedInterfaceRecordV1` shape (parser-compatible)
- No localStorage/store writes.

## Mapping Table

1. `dev.version` -> (implicit contract only; output record has no version field)
2. `dev.exportedAt` -> `record.createdAt`, `record.updatedAt`
3. `dev.title` -> `record.title`
4. `dev.parsedDocument` -> `record.parsedDocument` (or synthesized minimal object if null)
5. `dev.topology` -> `record.topology` (or empty `{ nodes: [], links: [], springs: [] }` if invalid)
6. `dev.analysisMeta` -> `record.analysisMeta`
7. `dev.layout` -> `record.layout`
8. `dev.camera` -> `record.camera`
9. synthesized deterministic -> `record.id` (`sample-preview:<slug>:<exportedAt>`)
10. `parsedDocument.id` fallback -> `record.docId`
11. preview mode -> `record.source='unknown'`
12. computed from parsedDocument/topology -> `record.preview.{nodeCount,linkCount,charCount,wordCount}`
13. computed canonical -> `record.dedupeKey` via `buildSavedInterfaceDedupeKey`

## Text Policy

- No truncation in adapter run.
- Full `parsedDocument.text` is preserved from dev export.
- If parsed document is missing, adapter synthesizes a valid minimal parsedDocument with empty text and zero counts.
