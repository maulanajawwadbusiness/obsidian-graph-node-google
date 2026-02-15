# Step 3 Hardening Run 1: Forensic Baseline

Date: 2026-02-15
Scope: Identify coercion and shallow validation gaps in dev-export to preview restore path.

## Current pipeline gates (today)

1. Dev export parse (shallow):
- File: `src/lib/devExport/devExportTypes.ts:24`
- `parseDevInterfaceExportV1(value)` returns `DevInterfaceExportV1 | null`.
- Checks only object/primitive shape and top-level object presence.
- Does not validate topology node/link semantics, layout nodeWorld coverage, camera numeric sanity beyond object presence.

2. Adapter (contains silent coercion):
- File: `src/lib/devExport/devExportToSavedInterfaceRecord.ts:66`
- `ensureTopology(...)` returns empty topology when missing/malformed:
  - `nodes: []`, `links: []`, `springs: []`.
- This allows malformed input to become structurally valid blank graph.
- `ensureParsedDocument(...)` also synthesizes fallback parsed document when missing.

3. Saved-record parser (shared, structural):
- File: `src/store/savedInterfacesStore.ts:167`
- `parseSavedInterfaceRecord(value)` delegates to `sanitizeSavedInterfaceRecord`.
- Verifies structural types (arrays, finite numbers for layout/camera if present), but not semantic integrity:
  - no edge endpoint existence checks
  - no non-empty topology requirement
  - no node/layout consistency requirement

4. Preview mount decision:
- File: `src/components/SampleGraphPreview.tsx:94`
- Current flow:
  - parseDevInterfaceExportV1 -> adapter -> parseSavedInterfaceRecord
  - if record exists and lease allowed and portal root exists, mount runtime at `src/components/SampleGraphPreview.tsx:137`
- Failure UI is one-line text with single error reason.

## What can slip through

1. Malformed or missing topology can be coerced to empty topology and still parse.
2. Topology edges can reference unknown node ids and still parse.
3. Layout can miss node ids for topology nodes if omitted in optional record shape path and still avoid semantic failure here.
4. Camera extreme values can pass if finite but nonsensical for preview UX.

## Critical fields for preview hardening (must not be silently coerced)

1. `topology.nodes` and `topology.links` presence + non-empty requirement for sample preview.
2. Node ids:
- non-empty strings
- unique
3. Link endpoints:
- every `from` and `to` references an existing topology node id.
4. `layout.nodeWorld`:
- required for each topology node in preview pipeline
- `x` and `y` must be finite numbers.
5. `camera`:
- `panX`, `panY`, `zoom` must be finite and sane for preview.

## Baseline conclusion

Current Step 3 pipeline has structural gates but allows silent fallback and semantic drift. Hardening should convert the preview path to fail-closed Result-based validation and block runtime mount on any invalid condition.