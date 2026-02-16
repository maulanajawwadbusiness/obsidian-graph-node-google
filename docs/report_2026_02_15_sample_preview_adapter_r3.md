# Report: Sample Preview Adapter Run 3

Date: 2026-02-15  
Scope: integrate preview sample data through canonical parse + pending restore path.

## Files Changed

1. `src/samples/sampleGraphPreview.export.json`
2. `src/components/SampleGraphPreview.tsx`

## Integration Path Implemented

In `SampleGraphPreview`:
1. static-import sample dev export JSON
2. `parseDevInterfaceExportV1(sample)` (shape guard)
3. `devExportToSavedInterfaceRecordV1(parsedDev, { preview: true })`
4. `parseSavedInterfaceRecord(candidateRecord)` (canonical validation)
5. pass validated record to runtime:
   - `pendingLoadInterface={parsedSampleRecord}`
   - `onPendingLoadInterfaceConsumed={() => {}}`

This is in-memory preview wiring only. No storage write path is called.

## Parse-Fail Behavior

- If dev export parse/adapter validation fails:
  - graph runtime is not mounted
  - inline fallback text shown: `sample graph invalid payload`
- This avoids default-seed spawn fallback from running when payload is invalid.

## Why Seed Spawn Is Replaced

- `GraphPhysicsPlaygroundShell` skips default spawn when `pendingLoadInterface` is present at init.
- By providing parsed sample record from first render, preview enters restore path instead of seed spawn path.
