# Arnvoid Document Viewer (Drop‑in Folder)

This folder is designed to be copied into the Arnvoid repo as‑is.

## Hard requirement: PDF worker in `public/`

The PDF engine **always** loads the worker from:

```
${import.meta.env.BASE_URL}pdf.worker.min.mjs
```

To guarantee this works in dev and prod, the host repo **must** place the
worker at `public/pdf.worker.min.mjs` so Vite serves it at the app base URL.

This folder includes the worker at:

```
src/ArnvoidDocumentViewer/public/pdf.worker.min.mjs
```

Copy it into the host’s `public/` as part of integration.

## Usage (host)

```tsx
import { ArnvoidDocumentViewer } from "./ArnvoidDocumentViewer";

<ArnvoidDocumentViewer source={source} />
```

Adapter methods are exposed via `ref` and follow the Arnvoid contract:
`scrollToPosition`, `highlightRange`, `clearHighlight`, `getCurrentPosition`,
`isVisible`.

## Required deps

Host must include these npm deps:
`pdfjs-dist`, `docx-preview`, `react-markdown`, `remark-gfm`,
`rehype-highlight`, `github-markdown-css`.
