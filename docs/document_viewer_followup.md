# Document Viewer Technical Follow-up

Date: 2026-01-27
Focus: Lifetime, Text Parity, Scroll Roots, and Input Isolation

========================
## 1) rawFile Lifetime & Ownership
========================

- **Storage**: `lastDroppedFile` is stored as a **React State hook** (`useState`) within the `GraphPhysicsPlaygroundInternal` component.
- **Lifecycle**:
  - **Set**: Triggered in `handleDrop` immediately upon a file drop event on the canvas.
  - **Cleared**: **Never**. Closing the viewer (clicking "✕ Close Viewer") only sets `previewOpen` to false in the `DocumentStore`. The `File` object remains in memory until overwritten by a new drop.
- **Preference**: The `HalfLeftWindow` **explicitly prefers** the `rawFile` state over the text stored in `DocumentStore`.
  - **Rationale**: To provide immediate visual feedback (e.g., rendering PDF pages) while the background worker is still extracting text for the knowledge graph.

**Snippet (Assignment)**:
`src/playground/GraphPhysicsPlayground.tsx` (Line 34, 223)
```tsx
const [lastDroppedFile, setLastDroppedFile] = useState<File | null>(null);
// ...
setLastDroppedFile(file);
```

**Snippet (Preference)**:
`src/playground/components/HalfLeftWindow.tsx` (Line 77)
```tsx
if (rawFile) {
    return { kind: 'file', file: rawFile }; // Takes priority
}
```

========================
## 2) Canonical Text vs Rendered Text
========================

- **Mismatch Observed**: **Yes (Structural/Whitespace)**.
- **Engine: PDF**:
  - `ParsedDocument.text` is a flattened stream of characters extracted by `getTextContent()`. It loses all layout context.
  - The viewer renders a pixel-perfect canvas.
  - **Result**: Vertical columns or tabled data in the PDF will appear as interleaved sentences in the canonical text but look normal in the viewer.
- **Engine: DOCX**:
  - `ParsedDocument.text` uses Mammoth's `extractRawText`, which discards all styles, images, and non-text elements.
  - The viewer (`docx-preview`) renders a full HTML layout.
  - **Result**: Tables and headers are stripped to raw strings in the canonical text.

**Observation**: No fixes implemented. The system relies on the visual fidelity of the viewer while the graph engine works with the simplified canonical text.

========================
## 3) Viewer Scroll Container
========================

- **Strategy**: Hybrid. The system uses a `data-arnvoid-scroll` attribute to identify the current root.
- **Shared Root**: used by DOCX, MD, and TXT.
  - Component: `ArnvoidDocumentViewer`
  - Class: `.arnvoid-viewer-scroll`
- **Specific Root**: used by PDF.
  - Component: `PdfCanvasStage`
  - Class: `.canvas-wrap`
  - **Note**: PDF scrolling happens inside the engine component to facilitate canvas/text-layer alignment during zoom.

**Sketch**:
```text
.arnvoid-viewer
└── .arnvoid-viewer-body
    ├── (If PDF) .pdf-engine.viewer -> .canvas-wrap [data-arnvoid-scroll]
    └── (If NOT PDF) .arnvoid-viewer-scroll [data-arnvoid-scroll]
```

**Paths**:
- Shared: `src/ArnvoidDocumentViewer/ArnvoidDocumentViewer.tsx`
- PDF-specific: `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/components/PdfCanvasStage.tsx`

========================
## 4) Popup Overlap Behavior
========================

- **Input Success**: **Confirmed**. Popups (`NodePopup`) correctly receive pointer input even when positioned directly over the left viewer window.
- **Z-Index**:
  - `HalfLeftWindow`: `400`
  - `NodePopup`: `1001`
- **Isolation Persistence**: The `HalfLeftWindow` continues to block events from reaching the graph underneath its area. However, the popup is a sibling to the entire app root (via `PopupOverlayContainer` portal) and maintains its own `pointerEvents: 'auto'`.
- **Interaction**: Clicking the "✕" or "Mini Chat" input on a popup over the viewer works as intended without triggering viewer scroll or text selection.

**Verification**: `NodePopup.tsx` (Line 24)
```tsx
zIndex: 1001,
pointerEvents: 'auto',
```
