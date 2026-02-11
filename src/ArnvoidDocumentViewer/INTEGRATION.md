# Arnvoid Document Viewer - Zero-Friction Integration Guide

You can treat this folder as a **drop-in module**. Your goal: mount one React component in the left panel and make sure the PDF worker file lives in `public/`. That's it.

---

## 0) What this is (in one minute)

This folder provides a **ready-to-use document viewer** that renders:
- **PDF** via PDF.js (with text layer for highlights)
- **DOCX** via `docx-preview`
- **Markdown** via `react-markdown`
- **Text** via `<pre>`

It already exposes the **Arnvoid adapter methods** you need:
`scrollToPosition`, `highlightRange`, `clearHighlight`, `getCurrentPosition`, `isVisible`.

---

## 1) Hard requirement (must do)

**Put the worker in `public/`** so it's served at the app root:

```
public/pdf.worker.min.mjs
```

The viewer **always** loads:

```
${import.meta.env.BASE_URL}pdf.worker.min.mjs
```

If this file is missing, PDFs will not render. No compromise.

This folder already includes the worker at:

```
src/ArnvoidDocumentViewer/public/pdf.worker.min.mjs
```

Copy that file into the host repo's `public/`.

---

## 2) Copy the folder into Arnvoid

Copy this entire folder into the Arnvoid repo:

```
src/ArnvoidDocumentViewer/
```

Do **not** change internal imports. The folder is self-contained.

---

## 2.1) Required npm deps (host must have these)

These are external packages used by the folder. If missing, the host build will fail:

- `pdfjs-dist` (must include `TextLayer` API; v4+ recommended)
- `docx-preview`
- `react-markdown`
- `remark-gfm`
- `rehype-highlight`
- `github-markdown-css`

If versions differ significantly, TypeScript may complain. Matching the viewer repo
versions is safest.

---

## 3) Mount it in the left panel

Find the left panel component (e.g. `HalfLeftWindow.tsx`) and mount:

```tsx
import { ArnvoidDocumentViewer } from "../ArnvoidDocumentViewer";

// inside render:
<ArnvoidDocumentViewer source={source} />
```

That's enough to see it render.

---

## 4) Where the `source` comes from

You can pass the viewer any of these:

```ts
// Raw file (best for PDF/DOCX)
{ kind: "file", file: File }

// Already parsed text
{ kind: "parsed", text: ParsedDocument.text }

// URL
{ kind: "url", url: "https://..." }

// ArrayBuffer
{ kind: "arrayBuffer", buffer: ArrayBuffer, fileName?: string }

// Plain text
{ kind: "text", text: string, formatHint?: "md" | "txt" }
```

If you have a `ParsedDocument` but also want PDF/DOCX fidelity, extend your state to carry the **raw File** and pass that instead.

---

## 5) Wiring the adapter (optional but recommended)

Use a `ref` to call adapter methods:

```tsx
const viewerRef = useRef<ArnvoidDocumentViewerAdapter>(null);

<ArnvoidDocumentViewer ref={viewerRef} source={source} />

// Later:
viewerRef.current?.scrollToPosition(1234);
viewerRef.current?.highlightRange(1200, 1250);
viewerRef.current?.clearHighlight();
```

All offsets are **character offsets** into the canonical text string.

**Important note:** for PDFs, the text-layer DOM order may not perfectly match
your canonical `ParsedDocument.text`, so offsets can be approximate. For exact
PDF mapping you'd need a PDF text mapping layer (not included).

---

## 6) Scrolling behavior (important)

The viewer **owns its internal scroll container**, especially for PDF.
So the left panel body should be treated as a **viewport shell**:

- set `overflow: hidden` when the viewer is mounted
- avoid extra padding around it

The viewer will handle its own padding for text engines.

---

## 7) Troubleshooting (fast)

**PDF shows blank / worker error**
- Confirm `public/pdf.worker.min.mjs` exists.
- Confirm it is served at `${import.meta.env.BASE_URL}pdf.worker.min.mjs`.

**Highlights don't show**
- Browser must support `CSS.highlights`.
- Your document must render real text nodes (PDF text layer covers this).

**Nothing renders**
- Confirm `source` is not null.
- Confirm `formatHint` if your source does not have a filename.

---

## 8) Quick sanity checklist

- [ ] `public/pdf.worker.min.mjs` exists
- [ ] `ArnvoidDocumentViewer` mounted in left panel
- [ ] Passing `source` correctly
- [ ] Left panel not double-scrolling (viewer owns scroll)

If all four are true, it **just works**.
