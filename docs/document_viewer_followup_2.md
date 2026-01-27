# Document Viewer Final Clarifications

Date: 2026-01-27
Focus: Memory Safety, Race Conditions, and Scroll Root Stability

========================
## 1) rawFile Memory + Lifecycle Risk
========================

- **Unbounded Growth**: **No**. `lastDroppedFile` is a single variable in playground state. Each new drop overwrites the previous reference.
- **Garbage Collection (GC)**: **Eligible**. Once `lastDroppedFile` is overwritten, the previous `File` object has no remaining references in the component tree and is eligible for GC.
- **Engine Cleanup**: 
  - **PDF**: `PdfViewer` calls `destroyDoc()` on every source change or unmount, which terminates the worker-side document proxy and releases its memory. It also explicitly closes all cached `ImageBitmap` objects via `clearCache()`.
  - **DOCX**: `ArnvoidDocumentViewer` clears the `innerHTML` of the docx container before every new render, releasing associated DOM and text nodes.

**Snippet (PDF Cache Purge)**:
`src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/hooks/usePdfRenderQueue.ts` (Line 158)
```tsx
export const clearCache = () => {
  for (const entry of cache.values()) {
    entry.bitmap.close(); // Mandatory manual release for ImageBitmaps
  }
};
```

========================
## 2) Viewer Source Switching Edge Cases
========================

- **Race Condition Analysis**: **Safe**.
- **Scenario**: If a user drops File B while File A is still being parsed by the worker:
  1. `handleDrop` synchronously sets `lastDroppedFile` to B.
  2. `HalfLeftWindow` immediately re-renders, showing File B via `rawFile` priority.
  3. When File A's worker parse finally completes and updates `DocumentStore.activeDocument`, the viewer **ignores it** because its source logic is locked to the `rawFile` of B.
- **Wrong Document Jump**: Not observed. The priority system ensures the viewer is always "loyal" to the most recent drop, regardless of asynchronous knowledge graph updates.

========================
## 3) Scroll-Root Discovery Mechanism
========================

- **Exclusivity**: Exactly **one** element with `data-arnvoid-scroll` is mounted at any given time.
- **Switching Engine**: The old scroll root is unmounted synchronously by React as part of the conditional `format === 'pdf' ? ... : ...` block in `ArnvoidDocumentViewer.tsx`.
- **Render Stability**: The `data-arnvoid-scroll` attribute is applied during the render pass, making it available as soon as the component is mounted to the DOM.

========================
## 4) Text-Layer Presence for PDF
========================

- **Status**: **Always Enabled**. The text layer is critical for search and selection and is NOT gated by the user-facing toolbar feature flag.
- **DOM Stability**:
  - The text layer container is a stable sibling of the canvas elements.
  - **Zoom Behavior**: During zoom, the layer's *content* is cleared (`innerHTML = ""`), but the container element itself is **reused**, maintaining valid DOM references for the adapter.
- **Highlighting**: Because the text layer is always present, the CSS Custom Highlight API and range offsets will remain functional throughout the app lifecycle.

========================
## 5) Intent Confirmation
========================

- **Simplified Canonical Text**: **YES**. `ParsedDocument.text` is intended as a lossy/simple stream for LLM/Search consumption.
- **Visual Fidelity Boundary**: **YES**. Aesthetic and structural fidelity is the exclusive responsibility of the `ArnvoidDocumentViewer`.
- **Graph Policy**: **YES**. Graph reasoning logic is expected to work with simplified text metadata.
