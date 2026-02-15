# Report: Sample Preview Adapter Run 4

Date: 2026-02-15  
Scope: robustness hardening for stable preview sample load and no-persistence behavior.

## Files Changed

1. `src/lib/devExport/devExportToSavedInterfaceRecord.ts`
2. `src/components/SampleGraphPreview.tsx`

## Hardening Applied

### Adapter runtime assertions

- Added `assertDevExportForAdapter(dev)` in adapter module.
- Guards now fail fast for:
  - invalid `version`
  - non-finite `exportedAt`
  - invalid `title`
- Adapter remains deterministic and pure (no storage writes).

### Stable load state + explicit failure reason

- `SampleGraphPreview` now computes a memoized `sampleLoadState`:
  - `{ record, error }`
- Failure branches are explicit:
  1. invalid dev-export shape (`parseDevInterfaceExportV1`)
  2. adapter failure (guard throw)
  3. canonical parse failure (`parseSavedInterfaceRecord`)
- Fallback now includes reason token:
  - `sample graph invalid payload (<reason>)`

### No persistence side effects

- Preview runtime still mounts with:
  - `pendingAnalysisPayload={null}`
  - `pendingLoadInterface={sampleLoadState.record}`
  - no saved-interface upsert/layout callbacks are passed in preview path.
- Result: preview uses restore path only, in-memory, without writes to saved interfaces storage.
