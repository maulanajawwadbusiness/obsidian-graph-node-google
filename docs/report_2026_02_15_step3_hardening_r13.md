# Step 3 Hardening Run 13: Dynamic Sample Import (Bundle Path)

Date: 2026-02-15
Scope: Move preview sample JSON loading to dynamic import with explicit loading state.

## Files updated

1. `src/components/SampleGraphPreview.tsx`
2. `src/lib/preview/validateCurrentSamplePreviewExport.ts`

## Changes

1. Dynamic sample loading in preview
- replaced static JSON import with `import('../samples/sampleGraphPreview.export.json')`
- load-on-mount with cleanup guard
- explicit loading branch: `loading sample...`

2. Pipeline gating updates
- new load-state errors:
  - `SAMPLE_LOADING`
  - `SAMPLE_IMPORT_FAILED`
- validation pipeline runs only after payload is loaded

3. Dev self-check utility updated
- utility now validates provided payload argument (no module-level JSON import)
- one-time warning still preserved

## Expected impact

- sample payload can be split out of eager prompt bundle path.
- runtime mount remains blocked until sample payload is loaded and validated.