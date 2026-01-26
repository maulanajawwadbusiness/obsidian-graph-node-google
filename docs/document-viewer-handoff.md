# Document Viewer Handoff (Future Integration) — Left Half Window + Adapter Contracts + “Ground Truth”

**Audience:** a fresh, “oblivious” code agent who must integrate a real document viewer later and make the existing popup/chat system able to **scroll + highlight** inside it.

**Goal:** you should be able to pick up this repo, wire in the *external* multi-engine document viewer (DOCX/MD/TXT/PDF engines) into a left half-window, implement/replace the adapter stubs, and have it **just work** without breaking the physics canvas interactions, popup system, or document parsing pipeline.

---

## 0) What already exists vs what you must build

### Already exists (working today)
- **Document parsing pipeline (worker-based)** that produces a `ParsedDocument` containing raw extracted `text` and metadata.
- **DocumentStore** (React Context) holding `activeDocument`, `status`, and a `previewOpen` boolean.
- A **basic left panel** (`TextPreviewPanel`) that renders `activeDocument.text` (read-only preview, 400px wide).
- A **popup system** (`NodePopup` + `MiniChatbar`) rendered in a portal overlay (`PopupOverlayContainer`) with predictable z-index.
- **Stub contracts** in `src/popup/adapters.ts` for:
  - `DocumentViewerAdapter` (scroll/highlight)
  - `ChatbarExpansionAdapter` (expand mini → full chatbar)

### You must build (future)
- A real **Document Viewer Window** that occupies the **left half of the screen** (replacing or superseding the current 400px panel).
- A real `DocumentViewerAdapter` implementation that the popup/chat layer can call:
  - `scrollToPosition(charOffset)`
  - `highlightRange(start, end)`
  - `clearHighlight()`
  - `getCurrentPosition()`
  - `isVisible()`
- The **plumbing** that makes popup/chat able to access the adapter (currently the adapter is *not referenced anywhere*).
- The **plumbing** to feed the external viewer the inputs it actually needs (today we only store extracted text, not the original file payload).

---

## 1) Critical file map (do not get lost)

### Document pipeline (worker + parsing)
- `src/store/documentStore.tsx`
  - Owns global doc state and exposes `parseFile(file)` returning `ParsedDocument`.
- `src/document/workerClient.ts`
  - Creates the worker via Vite syntax: `new Worker(new URL('./documentWorker.ts', import.meta.url), { type: 'module' })`
- `src/document/documentWorker.ts`
  - Worker entry; selects parser and returns `ParsedDocument`.
- Parsers (worker side):
  - `src/document/parsers/textParser.ts`
  - `src/document/parsers/docxParser.ts`
  - `src/document/parsers/pdfParser.ts` (pdf.js; text-only; warns on scanned PDFs)
- Data model:
  - `src/document/types.ts` (`ParsedDocument`, `DocumentState`)

### Current preview UI (existing left panel)
- `src/playground/components/TextPreviewButton.tsx`
- `src/playground/components/TextPreviewPanel.tsx`

### Popup/chat system (the thing that will call your viewer adapter)
- `src/popup/adapters.ts` (**contracts you must implement / replace stubs**)
- `src/popup/PopupStore.tsx` (state machine for popup + messages)
- `src/popup/PopupPortal.tsx` (mounts popups via portal)
- `src/popup/PopupOverlayContainer.tsx` (portal root: `zIndex: 1000`, `pointerEvents: none`)
- `src/popup/NodePopup.tsx` (`zIndex: 1001`, `pointerEvents: auto`)
- `src/popup/MiniChatbar.tsx` (`zIndex: 1002`, `pointerEvents: auto`)

### Main UI container (where your half-left window must live)
- `src/playground/GraphPhysicsPlayground.tsx`
  - Canvas + overlays are rendered inside a `position: relative` container (`MAIN_STYLE`).
  - Current preview panel + popup portal are mounted here.

---

## 2) Data model: what “charOffset” means (critical)

### `ParsedDocument`
Defined in `src/document/types.ts`.

Key fields you’ll rely on:
- `text: string` — raw extracted text (may include `\n\n` between PDF pages)
- `meta.charCount: number` — currently `text.length`
- `meta.wordCount: number`
- `meta.pages?: number` — PDF only
- `warnings: string[]` — includes scanned-PDF warning if extracted text is empty

### Canonical offset semantics
All offsets in the adapter contract must be interpreted as:
- **JavaScript string indices** into `ParsedDocument.text`
  - i.e. **UTF-16 code unit offsets** (what `text.length`, `text.slice()`, etc use)

Why this matters:
- If the viewer uses DOM Range APIs, they also operate on offsets into text nodes (effectively code units). This alignment makes scroll/highlight predictable.

**Rule:** Clamp every incoming offset:
- `0 <= start <= end <= text.length`
- `scrollToPosition()` clamps to `[0, text.length]`

---

## 3) Overlay stacking + pointer-event invariants (do not break the canvas)

### Stacking (z-index)
Current observed layers:
- Canvas + in-container overlays:
  - `TextPreviewButton`: `zIndex: 100`
  - `TextPreviewPanel`: `zIndex: 200`
- Portal overlay (fixed, on `document.body`):
  - `PopupOverlayContainer`: `zIndex: 1000`, `pointerEvents: none`
  - `NodePopup`: `zIndex: 1001`, `pointerEvents: auto`
  - `MiniChatbar`: `zIndex: 1002`, `pointerEvents: auto`
- Debug overlay: `zIndex: 999999` (always on top)

### Pointer-event rule (critical)
The physics canvas container (`GraphPhysicsPlayground.tsx`) listens to **pointer events** (not just mouse):
- `onPointerMove`, `onPointerDown`, etc are attached to the canvas wrapper.

Existing overlays typically call `stopPropagation` on `onMouseDown/onMouseMove/onMouseUp`.
That is sufficient for mouse, but **not guaranteed for touch/stylus/pointer events**.

**For the new Document Viewer Window:**
- You will encounter the canvas still reacting under the viewer unless the viewer blocks:
  - `pointerdown/pointermove/pointerup/pointercancel` propagation
  - `wheel` propagation (trackpads feel “leaky” otherwise)

This is the single most common cause of “viewer steals focus / canvas still reacts under it”.

---

## 4) Left half-window: what you will bump into (constraints, not implementation)

### Screen real estate + stacking
- You are placing a new “left half” window into a view that already contains:
  - A full-screen canvas underneath (`MAIN_STYLE` is `position: relative` and owns pointer handlers)
  - In-canvas overlays at z-indices ~100–200 (debug toggle, theme toggle, old preview panel)
  - Popups/chat in a fixed portal on `document.body` at z-indices ~1000+
- The viewer must sit **above** canvas overlays but **below** popup/chat overlays, otherwise:
  - it will be hidden under popups (bad)
  - or it will block popups (also bad)

### State you will meet
- **There is only one doc state source today:** `DocumentStore`:
  - `state.activeDocument: ParsedDocument | null`
  - `state.status: 'idle'|'parsing'|'ready'|'error'`
  - `state.previewOpen: boolean` (currently controls `TextPreviewPanel`)
- **Important dirt:** despite older docs, `parseFile()` does **not** auto-open `previewOpen`. If you need auto-open, you must add it deliberately.

### Relationship to existing `TextPreviewPanel`
What you inherit:
- `TextPreviewPanel` is an existence proof for:
  - “overlay UI without breaking canvas”
  - how metadata + warnings are displayed
  - how a close action is wired (`setPreviewOpen(false)`)

What will change:
- This repo’s “preview panel” is currently text-only and narrow (400px). Your left-half viewer will replace/supersede it.

---

## 5) `DocumentViewerAdapter`: contract you must satisfy

Defined in `src/popup/adapters.ts`.

### `scrollToPosition(charOffset: number): void`
**Requirement:** when called, the viewer scrolls so the character at `charOffset` becomes visible (ideally near top/center).

Minimum acceptable behavior:
- Scroll so the block/line containing `charOffset` is visible.

### `highlightRange(start: number, end: number): void`
**Requirement:** visually highlight that range in the rendered text.

Minimum acceptable behavior:
- A persistent highlight (not just temporary selection)
- Highlight survives minor scrolls and remains until cleared

### `clearHighlight(): void`
Remove any active highlight.

### `getCurrentPosition(): number`
Return the “current reading position” (top-most visible offset) as a char offset.

Minimum acceptable behavior:
- Returns a stable value that monotonically changes with scroll and is always in `[0, text.length]`.

### `isVisible(): boolean`
Return whether the viewer window is open and mounted.

---

## 6) External multi-engine viewer integration (assume you know the viewer well)

You will be integrating a document viewer with this architecture:
- A router `DocumentViewer.tsx` that chooses an engine based on file extension
- Engines render into one shared “document canvas” container:
  - DOCX → `docx-preview` DOM rendering
  - Markdown → `react-markdown` + `remark-gfm` (syntax highlighting)
  - TXT → `<pre>`
  - PDF → a PDF.js engine component that owns lifecycle/rendering/scroll and can expose a text-layer DOM
- Search/highlight is engine-agnostic via:
  - TreeWalker over real text nodes
  - CSS Custom Highlight API (`CSS.highlights`) (no DOM mutation)

### 6.1 The first ground hazard: this repo does not store what your viewer wants
Today, after parsing, the app stores only:
- `ParsedDocument.text` + small metadata

But your external viewer (especially for PDF, and for faithful DOCX rendering) typically needs:
- The original `File` (or `ArrayBuffer` / `Uint8Array`) to hand to its engine.

**So you will need to add a place to keep the “source payload”** (for the active doc), e.g.:
- store `File` on the document state, or
- store `{ fileName, mimeType, sourceType, arrayBuffer }`, or
- keep both “render payload” and “canonical text” side-by-side.

### 6.2 The second ground hazard: “offset text” must match “rendered text”
This repo’s `DocumentViewerAdapter` offsets currently implicitly refer to:
- `ParsedDocument.text` (worker-extracted plain text)

Your external viewer highlights by walking real text nodes and using CSS highlights.
That only “just works” if **the text you index/highlight against** matches the **text nodes rendered** by the engine.

You will encounter mismatch sources:
- DOCX engines may normalize whitespace or insert layout artifacts
- Markdown rendering can omit/transform syntax characters
- PDF text layers can reflow/splice text differently than extracted plain text

**You must pick a canonical text source for offsets** and keep it consistent across:
- node binding (`applyFirstWordsToNodes()` uses `document.text`)
- popup/chat references (future)
- adapter calls (`scrollToPosition`, `highlightRange`)
- the viewer’s internal text-node indexing

Practical consequence: you may need to evolve the state shape to include:
- `canonicalText` (the exact string used for offsets), AND
- `renderPayload` (the file/buffer used by the engine)

### 6.3 PDF-specific dirt: you already use pdf.js in a worker for parsing
In `src/document/parsers/pdfParser.ts`, pdf.js is used to extract plain text in the worker and it sets:
- `pdfjsLib.GlobalWorkerOptions.workerSrc = ...cdn...`

Your external viewer’s PDF engine may also use PDF.js (main thread) with its own worker/text-layer.
Be aware you’re dealing with:
- two different JS contexts (main vs worker) and potentially two PDF.js configurations
- “text layer required” for engine-agnostic TreeWalker highlighting

---

## 7) Wiring the adapter (the missing glue)

Right now:
- `DocumentViewerAdapter` exists only as a stub export in `src/popup/adapters.ts`.
- Nothing imports or calls it.

You must add a single source of truth that popup/chat can access.

### Recommended wiring (simple, robust)
Create a dedicated context:
- `DocumentViewerAdapterContext`
  - holds `adapter: DocumentViewerAdapter | null`
  - holds `setAdapter(adapter | null)`

Then:
- The viewer window component constructs the adapter (closing over DOM refs/state) and calls `setAdapter(adapter)` on mount, `setAdapter(null)` on unmount.
- Popup/chat components import a hook like `useDocumentViewerAdapter()` and call adapter methods when needed.

Alternative wiring (acceptable)
Extend `DocumentStore` to also expose the adapter, but keep responsibilities clean:
- DocumentStore currently focuses on parsing + doc state; mixing viewer concerns can get messy.

---

## 8) Integration points you’ll likely add next

### 8.1 Popup → viewer scroll
Common future flow:
- user clicks a node / or chat produces a citation referencing a document range
- popup/chat calls:
  - `adapter.scrollToPosition(offset)`
  - `adapter.highlightRange(start, end)`

### 8.2 Chat “clickable references”
The docs mention: “Clicking references in chat scrolls document”.
A robust pattern is to store message metadata:

```ts
type Message = {
  role: 'user' | 'ai';
  text: string;
  refs?: Array<{ start: number; end: number; label?: string }>;
}
```

Then render refs as clickable chips that call the adapter.

### 8.3 Full chatbar expansion
Not required for the viewer, but keep the mental model:
- mini chatbar is a separate window with its own positioning
- expansion adapter is stubbed (same “adapter wiring” approach works)

---

## 9) Node jump (future) — what exists and what doesn’t

The docs mention “node switching” (popup switches between nodes), but **there is no node-jump / camera-focus API today**.

What exists:
- A `PhysicsEngine` with nodes stored in a ref (`engineRef.current.nodes`)
- Rendering utilities inside `useGraphRendering()` returned to `GraphPhysicsPlayground.tsx`:
  - `clientToWorld()`, `worldToScreen()` (already used for popup anchor geometry)
- Hover/popup open is driven by `hoverStateRef.current.hoveredNodeId`

What you will need later for “document → node jump”:
- A way for the viewer (or chat) to request “focus node X” without coupling UI to physics internals.
- In practice this likely means adding a **narrow command API** near `useGraphRendering()` / camera layer (not inside physics), because:
  - the camera is intentionally internal/encapsulated
  - refs are used to avoid React re-render coupling

This doc does not define how to implement node jump; it flags the missing integration seam you’ll have to add.

---

## 10) Edge cases you must handle

- **No text extracted**: scanned PDFs may produce empty text and a warning.
  - viewer must not crash; show “No text extracted” + warnings.
- **Out-of-range offsets**: clamp and no-op safely.
- **Large documents**: keep UI responsive and avoid pathological DOM sizes (your external viewer likely already handles this; keep it in mind when wiring offsets/highlights).
- **Pointer event leakage**:
  - must stop pointer events so canvas hover/popup doesn’t trigger while interacting with viewer
- **Viewport resize**:
  - if fixed half-left, it naturally resizes; ensure scroll container height is `100%` minus header

---

## 11) Acceptance checklist (“just works”)

### Viewer window
- [ ] Opens as a **half-left window** (50vw) over the canvas
- [ ] Shows filename + meta + warnings
- [ ] Viewer engine renders correctly for DOCX/MD/TXT/PDF (using the external viewer)
- [ ] Scrolling inside viewer does not move/zoom the canvas
- [ ] Clicking/dragging text inside viewer does not open node popups

### Adapter methods
- [ ] `isVisible()` returns correct value
- [ ] `scrollToPosition(0)` scrolls to top reliably
- [ ] `scrollToPosition(text.length)` scrolls near bottom reliably
- [ ] `highlightRange(10, 50)` highlights persistently
- [ ] `clearHighlight()` removes highlight
- [ ] `getCurrentPosition()` changes as you scroll and is stable

### Coexistence with popups
- [ ] Node popup still opens on hovered node click (outside the viewer)
- [ ] Chatbar opens and stays above viewer (z-index order preserved)
- [ ] Viewer doesn’t block popup interactions on the right half

---

## 12) Suggested next doc to write after implementation

Once you implement the viewer, add a short doc:
- “How to create clickable doc references from AI responses”
- “How to compute ranges (start/end) for citations”

Because the adapter contract is only half the job—the other half is producing meaningful offsets/ranges from AI + node context.

