# Forensic Report: Document Viewer Width Authority Violation

Date: 2026-02-09
Author: Codex forensic scan
Scope: Graph screen left viewer width control (30% or 50%) being overridden at runtime.

## Executive Summary
The primary cause is not an external auto-layout service. The root is local flex sizing behavior plus intrinsic content width from the PDF engine.

Your width knob in `src/playground/components/HalfLeftWindow.tsx:14` (`flex: '0 0 30%'`) is treated as a preference, not an absolute floor/ceiling, because the flex item still has default `min-width: auto` (implicit browser default). When PDF content reports a large intrinsic width, the flex item refuses to shrink and expands beyond 30%, which visually looks like 60-70% in wide documents.

## What Is Happening
1. Left panel sets basis width to 30%.
2. PDF engine renders a page with a concrete pixel width (`viewport.width`) and injects that width into stage elements.
3. Flex layout computes min-content constraints.
4. Because `HalfLeftWindow` has no explicit `minWidth: 0`, content min-width can dominate basis width.
5. Panel expands beyond requested ratio.

## Why It Happens
### A) Panel width control is incomplete (authority gap)
- File: `src/playground/components/HalfLeftWindow.tsx:14`
- Current control: `flex: '0 0 30%'`
- Missing: explicit `minWidth: 0` (and optionally bounded width policy).

In flexbox, `flex-basis` alone does not guarantee final width when intrinsic min-content width is larger.

### B) PDF engine emits hard pixel stage width
- File: `src/ArnvoidDocumentViewer/engines/PdfEngine/PdfViewer.tsx:37`
- Default scale is `1.25`, increasing page width.
- File: `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/hooks/usePdfRenderQueue.ts:66`
  - `setStageSize(width, height)` writes explicit `style.width = "${width}px"`.
- File: `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/hooks/usePdfRenderQueue.ts:328`
  - `cssWidth = viewport.width` then stage width is set from this value.
- File: `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/constants.ts:6`
  - `MIN_RENDER_SCALE = 1.25` prevents render scale lower than 1.25.

This makes intrinsic content width large early, increasing pressure on parent flex min-content sizing.

### C) Stage centering reinforces large intrinsic width
- File: `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-engine.css:125`
  - `.canvas-stage { margin: 0 auto; }`
- Stage content width is explicitly set and centered, which is good visually, but still contributes to min-content behavior.

## Where The Authority Break Occurs
- Primary break: `src/playground/components/HalfLeftWindow.tsx:14` (panel flex sizing without min-width override).
- Content pressure source: `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/hooks/usePdfRenderQueue.ts:66`, `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/hooks/usePdfRenderQueue.ts:328`.

## When This Became Likely
- Integration report still documents a 50% lock:
  - `docs/document_viewer_report.md:64` (`flex: 0 0 50%`)
  - `docs/document_viewer_report.md:141` (locked width bug note)
- Current code now uses 30%, but supporting overlays still assume 50vw (see overlap section). This indicates split policy drift over time.

## How To Reproduce Reliably
1. Open viewer with a PDF document.
2. Keep panel knob at `flex: '0 0 30%'`.
3. Use wide page document or any standard A4/letter at current render scale 1.25.
4. Observe panel visually exceeds 30%.

## Code Overlap And Future Risk
### 1) Overlay positioning is hardcoded to 50vw
- `src/playground/components/CanvasOverlays.tsx:191`
  - `left: viewerOpen ? 'calc(50vw + 16px)' : ...`
- `src/playground/components/AIActivityGlyph.tsx:15`
  - `left: viewerOpen ? 'calc(50vw + 160px)' : ...`

If viewer width knob is 30%, these overlays still behave as if viewer is 50%. This creates visual drift and reinforces perception that layout is "fighting" user control.

### 2) Documentation drift
- `docs/document_viewer_report.md` states old 50% split while runtime code uses 30%.
- This increases regression risk when future edits copy stale assumptions.

## Root Cause Statement (Single Line)
The viewer panel ratio control is not authoritative because parent flex min-content constraints are not neutralized, and PDF stage width writes fixed pixel sizes that can force the flex item wider than its configured basis.

## Priority Fix Direction (For Next Implementation Pass)
1. Enforce panel authority at container seam.
2. Add explicit min-width handling so content cannot upsize panel beyond knob.
3. Replace all `50vw` overlay offsets with a single shared "viewer width ratio" source.
4. Update documentation to remove stale 50% assumptions.

## Suggested Verification Checklist
- Set knob 30%: panel must remain exactly 30% across PDF, DOCX, MD, TXT.
- Set knob 50%: panel must remain exactly 50%.
- No overlay drift (debug panel and AI glyph align with actual panel boundary).
- Canvas interaction unchanged and pointer shielding unchanged.
