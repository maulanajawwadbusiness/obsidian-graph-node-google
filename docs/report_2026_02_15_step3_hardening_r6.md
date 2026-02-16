# Step 3 Hardening Run 6: Preview-Only Saved Record Wrapper + Wiring

Date: 2026-02-15
Scope: Tighten preview structural gating without changing global parser behavior.

## File added

- `src/lib/devExport/parseSavedInterfaceRecordForPreview.ts`

## Wrapper behavior

`parseSavedInterfaceRecordForPreview(value)`:
1. Calls shared `parseSavedInterfaceRecord(value)`.
2. Converts null parse into Result error (`SAVED_RECORD_PARSE_FAILED`).
3. Adds preview-critical presence checks:
- topology nodes/links arrays required
- layout.nodeWorld required
- camera required

## Preview wiring changes

Updated `src/components/SampleGraphPreview.tsx`:
1. Replaced shallow parser with strict parser:
- from `parseDevInterfaceExportV1(...)`
- to `parseDevInterfaceExportStrict(...)`
2. Replaced direct saved parser with preview wrapper:
- `parseSavedInterfaceRecordForPreview(...)`

## Scope discipline

- Global `parseSavedInterfaceRecord(...)` behavior remains unchanged.
- Hardening applies to sample preview path only.