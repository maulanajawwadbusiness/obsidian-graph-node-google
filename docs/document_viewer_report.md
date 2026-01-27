# Document Viewer Integration Report

Date: 2026-01-27
Status: Implemented & Verified

========================
## A) CHANGE SUMMARY (WHAT WAS DONE)
========================

### 1) File Changes
- **`src/playground/GraphPhysicsPlayground.tsx`**: Replaced the overlay-based `TextPreviewPanel` with `HalfLeftWindow` using a flex-split layout. Integrated `DocumentProvider` at root.
- **`src/playground/components/HalfLeftWindow.tsx`**: New component implementing the left-side panel with pointer event isolation and `ArnvoidDocumentViewer` mounting.
- **`src/playground/components/TextPreviewButton.tsx`**: Updated to toggle the new `HalfLeftWindow`.
- **`src/ArnvoidDocumentViewer/`**: Entirely new module for document rendering (PDF, DOCX, MD, TXT).
- **`src/store/documentStore.tsx`**: Updated with `aiActivity` tracking and `previewOpen` state.
- **`src/playground/graphPlaygroundStyles.ts`**: Updated `CONTAINER_STYLE` to `display: flex` to support the side-by-side view.

### 2) Key Code Snippets

**Left Window Mounting & Layout:**
In `GraphPhysicsPlayground.tsx`, the layout is now a side-by-side flexbox:
```tsx
<div style={{ ...CONTAINER_STYLE }}>
    <HalfLeftWindow
        open={documentContext.state.previewOpen}
        onClose={() => documentContext.setPreviewOpen(false)}
        rawFile={lastDroppedFile}
    />
    <div style={MAIN_STYLE} onDrop={handleDrop}>
        <canvas ref={canvasRef} />
    </div>
</div>
```

**DocumentViewer Mounting:**
Inside `HalfLeftWindow.tsx`, the viewer receives the source derived from either the `rawFile` (from drop) or the `activeDocument` (from store):
```tsx
const source = useMemo<ViewerSource | null>(() => {
    if (rawFile) return { kind: 'file', file: rawFile };
    const doc = state.activeDocument;
    if (!doc) return null;
    return { kind: 'text', text: doc.text, formatHint: doc.sourceType === 'md' ? 'md' : 'txt' };
}, [rawFile, state.activeDocument]);
```

### 3) Confirmation
- [x] **TextPreviewButton** was repurposed to toggle the left window.
- [x] **TextPreviewPanel** was **removed** from the codebase.

========================
## B) LAYOUT + RESIZE BEHAVIOR (CRITICAL)
========================

### 1) DOM Structure
```text
div (CONTAINER_STYLE: flex, 100vw/100vh)
├── HalfLeftWindow (PANEL_STYLE: flex 0 0 50%, z-index 400)
└── div (MAIN_STYLE: flex 1, position relative)
    ├── canvas (100% width/height)
    └── Overlays / Popups
```

### 2) CSS / Style Values
- **Width**: `flex: 0 0 50%` (Locked 50% split).
- **Z-Index**: `400` (Above Canvas, below Popups).
- **Overflow**: `overflow: hidden` + `overscroll-behavior: contain` on body.

### 3) Canvas Resize
- **Detection**: `useGraphRendering.ts` reads `canvas.getBoundingClientRect()` every frame.
- **Sync**: `engine.updateBounds` is called immediately on change.
- **Jitter**: None; flex layout updates and engine bounds sync in the same frame.

========================
## C) POINTER / INPUT ISOLATION (CRITICAL)
========================

### 1) Isolation Code (`HalfLeftWindow.tsx`)
```tsx
<div
    style={PANEL_STYLE}
    onPointerDownCapture={stop}
    onPointerMoveCapture={stop}
    onPointerUpCapture={stop}
    onPointerCancelCapture={stop}
    onWheelCapture={stopWheel}
>
```

### 2) Confirmation
- [x] **Hover Glow**: Blocked when mouse is in left window.
- [x] **Zoom/Pan**: Scroll wheel inside left window does not affect canvas.
- [x] **Drag/Popups**: Clicks inside left window do not interact with nodes.

========================
## D) DOCUMENT VIEWER INTEGRATION
========================

### 1) Architecture
- **Path**: `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`
- **Props**: `source: ViewerSource | null`.

### 2) Engine Specifics
- **PDF**: PDF.js with Text Layer enabled and worker at `/pdf.worker.min.mjs`.
- **DOCX**: `docx-preview` using `renderAsync`.
- **Markdown**: `react-markdown` with GFM + Syntax Highlighting.
- **Input**: Original `File` or `ParsedDocument.text`.

========================
## E) STATE + DATA FLOW (GROUND TRUTH)
========================

### 1) DocumentStore
- Tracks `activeDocument` (metadata + text), `previewOpen`, and `aiActivity`.

### 2) Drag & Drop
- Dropping on left window is **blocked**.
- Dropping on canvas parses the file, updates the viewer immediately with raw file, and triggers AI label binding.

### 3) Binding
- `applyFirstWordsToNodes` runs instantly after parse.
- `applyAILabelsToNodes` runs as background AI activity.

========================
## F) Z-INDEX + OVERLAY COEXISTENCE
========================

### 1) Layering
1. `999999`: Debug Overlay
2. `1002`: MiniChatbar
3. `1000`: Popup Portal (`NodePopup`)
4. **`400`**: **Left Window**
5. `100`: TextPreviewButton

### 2) Confirmation
- [x] Popups appear above viewer; viewer does not block popups unless they physically overlap.

========================
## G) BUGS / RISK LIST
========================

1. **Repro Bug**: Horizontal resize handle missing (locked at 50%).
2. **Risk**: PDF.js worker version mismatch if environment changes.
3. **Risk**: Large DOCX files may cause minor memory bloat due to DOM re-renders.

========================
## H) QUICK COMMANDS / HOW TO TEST
========================

1. Click **📄 Open Viewer** (bottom left).
2. Drop any `.pdf`, `.docx`, or `.txt` into the **right side**.
3. Verify viewer content on the left and node labels on the right.
