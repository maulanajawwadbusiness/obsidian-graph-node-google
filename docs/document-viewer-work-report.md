# Document Viewer Integration Work Report

Date: 2026-01-27
Branch: second-document-viewer

## Summary
This report captures the completed integration work for the left panel Document Viewer, DOCX rendering fixes, PDF navigation controls (keyboard + UI), and the recovery of lost commits after branch checkout churn.

## Work Completed

### 1) Mount ArnvoidDocumentViewer in the left panel
- Replaced the placeholder content in `HalfLeftWindow` with the actual `ArnvoidDocumentViewer` component.
- Ensured the left panel body is a viewport shell (overflow hidden, no padding), letting the viewer own internal scrolling.
- Preserved pointer/wheel capture on the left panel so the canvas does not receive input under overlays.

Files involved:
- `src/playground/components/HalfLeftWindow.tsx`

### 2) DOCX rendering pipeline: pass raw file (without touching DocumentStore)
- Introduced `lastDroppedFile` state in `GraphPhysicsPlayground` to keep the most recent file payload, without changing DocumentStore.
- Passed this raw file into `HalfLeftWindow` to feed the viewer a `{ kind: "file" }` source when present.
- This enables docx-preview to render DOCX as paged layout instead of falling back to parsed text.

Files involved:
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/playground/components/HalfLeftWindow.tsx`

### 3) Fix docx-preview CSS import error
- Removed the invalid import `docx-preview/dist/docx-preview.css` (not exported by the package).
- The library injects wrapper/page styling programmatically, so this import is unnecessary and breaks Vite.

Files involved:
- `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`

### 4) PDF keyboard page navigation (ArrowUp/ArrowDown)
- Added a focusable PDF viewer root so keyboard navigation is scoped to the PDF view.
- Implemented capture-phase key handling that only triggers when focus is inside the PDF viewer.
- ArrowUp = previous page, ArrowDown = next page; ignores inputs/textarea/contentEditable.

Files involved:
- `src/ArnvoidDocumentViewer/engines/PdfEngine/PdfViewer.tsx`

### 5) PDF bottom-right page nav buttons are clickable
- Raised `.page-nav` z-index above the PDF text layer, which was intercepting clicks.
- This makes the previous/next page buttons functional.

Files involved:
- `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-engine.css`

### 6) Recovery of lost commits after checkout
- Located missing work via reflog and cherry-picked onto `second-document-viewer`.
- New SHAs (post-cherry-pick):
  - `de36f2d` — documentviewer loaded, docx view mount up
  - `6275cf9` — pdf view keyboard pagenav work
  - `dd1b689` — pdf view wire the ui pagenav too

## Future Bugs / Follow-ups
1) TXT/MD view: spacing and margins are poor. Text gets cut off and lacks proper padding and layout. Needs improved margin/spacing in a future pass.
2) DOCX view background: the docx-preview wrapper uses a gray page background. Change it to navy blue in a later UX pass.
3) PDF view flicker: the canvas briefly shows a blank/early layout before real PDF content renders. Reduce or eliminate this flicker later.

## Verification
- No automated tests run. Manual behavior confirmed during iteration.
