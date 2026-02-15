# Step 3 Hardening Run 12: Dev Self-Check Utility (Warn Once)

Date: 2026-02-15
Scope: Add one-time dev validation utility for current sample export.

## File added

- `src/lib/preview/validateCurrentSamplePreviewExport.ts`

## Utility functions

1. `validateCurrentSamplePreviewExport(): Result<void>`
- runs strict preview pipeline over current bundled sample export
- strict dev parse -> adapter -> preview saved parse wrapper -> semantic validator

2. `warnIfInvalidCurrentSamplePreviewExportOnce(): void`
- dev-only
- logs one warning if sample is invalid
- module-level guard prevents repeated spam

## Preview wiring

- `src/components/SampleGraphPreview.tsx`
- `useEffect` invokes `warnIfInvalidCurrentSamplePreviewExportOnce()` once on mount.

## Scope discipline

- No runtime behavior changes for valid sample path.
- No new persistence or side effects outside dev console warning.