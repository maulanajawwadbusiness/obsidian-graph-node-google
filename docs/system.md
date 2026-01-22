# System Architecture – Obsidian-Style Graph Physics Engine

## Repository Structure

```
.
├── docs/
│   ├── handoff.md
│   ├── physics-engine-audit.md
│   ├── system.md
│   ├── tuning-guide.md
│   └── vision.md
├── public/
│   └── Quicksand-Light.ttf
├── src/
│   ├── ai/                          ← AI client scaffolding
│   │   ├── clientTypes.ts          ← LLMClient interface
│   │   ├── index.ts                ← Factory + exports
│   │   ├── labelRewriter.ts        ← 3-word sentence generator
│   │   ├── openaiClient.ts         ← OpenAI adapter
│   │   └── openrouterClient.ts     ← OpenRouter adapter
│   ├── assets/
│   │   ├── Quicksand-Light.ttf
│   │   └── send_icon.png           ← Chat send button icon
│   ├── docs/
│   │   └── organic-shape-creation.md
│   ├── document/                    ← Document pipeline
│   │   ├── bridge/
│   │   │   ├── docGraphBridge.ts   ← Document↔graph bridge API
│   │   │   └── nodeDocRef.ts       ← NodeDocRefV1 types + validation
│   │   ├── viewer/
│   │   │   ├── docTheme.ts         ← Theme tokens (light/dark)
│   │   │   ├── documentModel.ts    ← Block builder (text→blocks)
│   │   │   ├── DocumentBlock.tsx   ← Single block renderer
│   │   │   ├── DocumentContent.tsx ← Block list + virtualization
│   │   │   ├── DocumentDockStrip.tsx ← Presence strip (spine+handle)
│   │   │   ├── DocumentViewerPanel.tsx ← Main viewer container
│   │   │   ├── SearchBar.tsx       ← Search input + navigation
│   │   │   ├── searchSession.ts    ← Match computation
│   │   │   ├── selectionMapping.ts ← DOM↔offset conversion
│   │   │   └── useVirtualBlocks.ts ← Virtualization hook
│   │   ├── nodeBinding.ts          ← Word→node label + ref attachment
│   │   ├── parsers.ts              ← Unified parser adapters
│   │   └── types.ts                ← ParsedDocument + ViewerMode
│   ├── physics/
│   │   ├── config.ts
│   │   ├── engine/
│   │   │   ├── constraints.ts
│   │   │   ├── corrections.ts
│   │   │   ├── debug.ts
│   │   │   ├── degrees.ts
│   │   │   ├── energy.ts
│   │   │   ├── escapeWindow.ts
│   │   │   ├── forcePass.ts
│   │   │   ├── impulse.ts
│   │   │   ├── integration.ts
│   │   │   ├── preRollPhase.ts
│   │   │   ├── stats.ts
│   │   │   ├── velocity/              ← Modularized velocity passes
│   │   │   │   ├── angleResistance.ts
│   │   │   │   ├── angularVelocityDecoherence.ts
│   │   │   │   ├── baseIntegration.ts
│   │   │   │   ├── carrierFlow.ts
│   │   │   │   ├── damping.ts
│   │   │   │   ├── debugVelocity.ts
│   │   │   │   ├── denseCoreInertiaRelaxation.ts
│   │   │   │   ├── denseCoreVelocityUnlock.ts
│   │   │   │   ├── distanceBias.ts
│   │   │   │   ├── dragVelocity.ts
│   │   │   │   ├── edgeShearStagnationEscape.ts
│   │   │   │   ├── energyGates.ts
│   │   │   │   ├── expansionResistance.ts
│   │   │   │   ├── hubVelocityScaling.ts
│   │   │   │   ├── localPhaseDiffusion.ts
│   │   │   │   ├── lowForceStagnationEscape.ts
│   │   │   │   ├── preRollVelocity.ts
│   │   │   │   ├── relativeVelocityUtils.ts
│   │   │   │   └── staticFrictionBypass.ts
│   │   │   └── velocityPass.ts        ← Thin facade re-exporting velocity modules
│   │   ├── engine.ts
│   │   ├── forces.ts
│   │   ├── test-physics.ts
│   │   └── types.ts
│   ├── playground/
│   │   ├── components/
│   │   │   ├── AIActivityGlyph.tsx  ← AI loading indicator
│   │   │   ├── CanvasOverlays.tsx
│   │   │   ├── DebugPanel.tsx
│   │   │   └── SidebarControls.tsx
│   │   ├── rendering/
│   │   │   ├── camera.ts
│   │   │   ├── canvasUtils.ts
│   │   │   ├── graphDraw.ts
│   │   │   ├── hoverController.ts
│   │   │   ├── hoverEnergy.ts
│   │   │   ├── metrics.ts
│   │   │   ├── renderingMath.ts
│   │   │   └── renderingTypes.ts
│   │   ├── GraphPhysicsPlayground.tsx
│   │   ├── graphRandom.ts
│   │   └── useGraphRendering.ts
│   ├── popup/                       ← Node popup system
│   │   ├── adapters.ts              ← Document viewer adapter (real)
│   │   ├── ChatInput.tsx            ← Expandable chat input (5 lines max)
│   │   ├── MiniChatbar.tsx          ← Mini chat window
│   │   ├── NodePopup.tsx            ← Main popup component
│   │   ├── PopupOverlayContainer.tsx ← Shared portal
│   │   ├── PopupPortal.tsx          ← Portal renderer
│   │   ├── PopupStore.tsx           ← Popup state context
│   │   ├── popupTypes.ts            ← State + action types
│   │   ├── seedPopupTypes.ts        ← Future animation module contract
│   │   └── useAnchorGeometry.ts     ← Geometry provider hook
│   ├── store/
│   │   └── documentStore.tsx        ← Document state management
│   ├── utils/
│   │   └── seededRandom.ts
│   ├── visual/
│   │   └── theme.ts
│   ├── workers/
│   │   └── documentWorker.ts        ← Off-main-thread parsing
│   ├── index.css
│   └── main.tsx
├── index.html
├── package-lock.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Data Pipeline Architecture

### Document Ingestion System

**Purpose:** Unified document parsing pipeline that converts various file formats into structured text without blocking the main thread.

**Supported Formats:**
- **Plain text:** `.txt`, `.md` (direct UTF-8 decode)
- **Word documents:** `.docx` (mammoth.js library, extracts paragraphs)
- **PDF files:** `.pdf` (pdf.js library, text-based extraction)
  - **Limitation:** Scanned/image-only PDFs → "No text extracted" warning (no OCR)

**Not Supported (Yet):**
- **Legacy Word:** `.doc` requires server-side conversion (LibreOffice/Antiword) or user conversion to `.docx`

**UX Flow:**
1. Drag-drop file anywhere on canvas
2. File sent to Web Worker for parsing (non-blocking)
3. Progress tracked via `DocumentStore` status (idle → parsing → ready → error)
4. On completion: text available to consumers (node binding, document viewer)

**Dataflow:**
```
File Drop (GraphPhysicsPlayground.tsx)
    ↓
createFileParser() (parsers.ts)
    ↓ adapter selection based on MIME type
Web Worker (documentWorker.ts)
    ↓ off-main-thread parsing
ParsedDocument object
    ↓ posted back to main thread
DocumentStore.activeDocument
    ↓ consumed by
Node Binding (nodeBinding.ts)
Document Viewer (DocumentViewerPanel.tsx)
```

**ParsedDocument Interface:**
```typescript
interface ParsedDocument {
  id: string;           // UUID
  fileName: string;     // Original filename
  mimeType: string;     // e.g. 'text/plain', 'application/pdf'
  sourceType: 'txt' | 'md' | 'docx' | 'pdf';
  text: string;         // Extracted plain text
  wordCount: number;
  warnings: string[];   // e.g. "No text extracted (scanned PDF?)"
  metadata?: {
    pages?: number;     // PDF only
    createdAt?: string;
  };
}
```

**Worker Architecture:**
- **File:** `src/workers/documentWorker.ts`
- **Purpose:** Isolate expensive parsing (PDF rendering, DOCX unzip) from main thread
- **Communication:** `postMessage({ type: 'PARSE_FILE', ... })` → worker → `postMessage({ type: 'PARSE_COMPLETE', document })`
-File Ownership:**
  - `src/document/parsers.ts` - Format-specific adapters
  - `src/document/types.ts` - `ParsedDocument` + `DocumentStatus`
  - `src/workers/documentWorker.ts` - Worker entry point

---

### Document Store (State Management)

**Architecture:** React Context + reducer pattern

**State Shape:**
```typescript
interface DocumentState {
  status: 'idle' | 'parsing' | 'ready' | 'error';
  activeDocument: ParsedDocument | null;
  errorMessage?: string;
  viewerMode: 'peek' | 'open';     // Viewer is always visible (organ, not modal)
  docThemeMode: 'light' | 'dark';  // Independent from graph skin
  highlightRanges: HighlightRange[]; // Active highlights
  aiActivity: boolean;             // AI request in progress
}

interface HighlightRange {
  start: number;   // Character offset (inclusive)
  end: number;     // Character offset (exclusive)
  id?: string;     // 'active' | 'other-N' for styling
}
```

**Actions:**
- `SET_STATUS` - Update parsing status
- `SET_DOCUMENT` - Store parsed document
- `SET_ERROR` - Store error message
- `TOGGLE_VIEWER` - Toggle between peek ↔ open
- `SET_VIEWER_MODE` - Explicit peek/open
- `SET_DOC_THEME` - Switch light/dark theme
- `SET_HIGHLIGHTS` - Update highlight ranges
- `SET_AI_ACTIVITY` - Track AI request lifecycle
- `CLEAR_DOCUMENT` - Reset to idle state

**File:** `src/store/documentStore.tsx`

**Usage:**
```typescript
const { state, parseFile, toggleViewer, setHighlights, viewerApiRef } = useDocument();
```

**Viewer API Ref:**
- `viewerApiRef.current?.scrollToOffset(charOffset)` - Programmatic scroll
- Used by adapters and bridge for reveal functionality

---

### Document Viewer v1 ("Organ, Not Modal")

**Philosophy:** The viewer is a permanent left-edge presence (like an organ), never fully hidden.

**State Model:**
- `viewerMode: 'peek' | 'open'` — No "closed" state
- `peek`: 44px total width (12px spine + 32px sliver)
- `open`: 400px full panel
- Viewer **pushes** canvas content (flex-row sibling, not overlay)

**Presence Strip (Always Visible):**

**Layer 1 - Spine (12px):**
- Gradient: `linear-gradient(to right, rgba(0,0,0,0), rgba(..., 0.42))`
- Hairline border: `1px solid rgba(99, 171, 255, 0.22)`
- Subtle inner glow on hover
- Cursor: `ew-resize`
- Click: toggles viewer

**Layer 2 - Handle Pill (22px × 64px):**
- Pill-shaped (`border-radius: 999px`)
- Always visible, vertically centered
- Chevron icon: → (peek) | ← (open)
- Loaded indicator dot (6px, blue when doc present)
- Cursor: `pointer`
- Click: toggles viewer

**Layer 3 - Peek Sliver (32px effective):**
- Only visible when `viewerMode === 'peek' && activeDocument !== null`
- Faint sheet edge texture
- `pointer-events: none` (non-interactive)

**Files:**
- `src/document/viewer/DocumentDockStrip.tsx` - Presence strip
- `src/document/viewer/DocumentViewerPanel.tsx` - Main container

---

**Panel Animation:**
- **Expand (peek → open):** 220ms `cubic-bezier(0.22, 1, 0.36, 1)`
- **Collapse (open → peek):** 180ms `cubic-bezier(0.22, 1, 0.36, 1)`
- No bounce, no text scaling

**Keyboard Shortcuts:**
- `Ctrl+F` - Opens search (also opens viewer if peek)
- `Ctrl+\` - Toggles peek ↔ open
- `Esc` - Returns to peek (when not in search)

---

**Independent Doc Theme:**
- `docThemeMode: 'light' | 'dark'` — Separate from graph `SkinMode`
- **Dark mode:** Quicksand font (weight 300), dark sheet
- **Light mode:** System font (weight 400), light sheet
- Theme tokens exposed as CSS variables (`--doc-*`)

**Typography Contract:**
- Base size: `15px`
- Line height: `1.6`
- Paragraph gap: `0.75em`
- Max line width: `68ch`

**File:** `src/document/viewer/docTheme.ts`

---

**Viewer Internal Data Model:**

**Block Model:**
- Text split into blocks (paragraphs) at newline boundaries
- Each block has `[start, end)` character offset range (half-open)
- Offsets are global to `activeDocument.text`
- **Newline handling:** Newlines excluded from block text, offset advances by `line.length + 1`

```typescript
interface TextBlock {
  blockId: string;   // React key ('b0', 'b1', ...)
  start: number;     // Global char offset (inclusive)
  end: number;       // Global char offset (exclusive)
  text: string;      // Line content (no trailing \n)
}
```

**Run Model:**
- Each block split into "runs" (spans) when highlights present
- Each `<span>` has `data-start` and `data-end` attributes
- Used for DOM ↔ offset mapping

**Highlight Model:**
- `HighlightRange { start, end, id? }`
- `id === 'active'` → `.highlight-active` class (search result / reveal)
- `id !== 'active'` or missing → `.highlight-other` class
- Highlights are **background-only** (no layout shift)

**Files:**
- `src/document/viewer/documentModel.ts` - Block builder
- `src/document/viewer/DocumentBlock.tsx` - Block + run renderer
- `src/document/viewer/DocumentContent.tsx` - Block list

---

**Offset ↔ DOM Mapping Strategy:**

**Problem:** Need to scroll to/select text by character offset without full-text walk.

**Solution:**
- Each rendered `<span>` carries `data-start` and optionally `data-end`
- `selectionToOffsets(selection)` - Finds nearest span ancestors, reads data-* attrs
- `offsetsToRange(container, start, end)` - Queries spans, creates DOM Range
- `findSpanContaining(container, offset)` - Binary search via querySelectorAll

**No per-frame coupling:** All offset work is event-driven (search, click, reveal).

**File:** `src/document/viewer/selectionMapping.ts`

---

**Rendering Strategy v1:**

**No Virtualization for Small Docs:**
- Threshold: 50 blocks
- Below threshold: Render all blocks (simple, fast)

**Virtualization for Large Docs (50+ blocks):**
- RAF-throttled scroll handler
- Overscan: ±3 blocks
- Height cache: `Map<blockId, height>` persisted in `useRef`
- Spacer divs: `topSpacerHeight` + `bottomSpacerHeight`
- Measured via element `clientHeight` (no ResizeObserver in v1)

**Current Status:** Virtualization wired but threshold set high (50 blocks). Works well for moderate docs.

**File:** `src/document/viewer/useVirtualBlocks.ts`

**Hard Invariant:** No per-frame coupling to physics loop. Viewer is fully event-driven.

---

**Search Session Internals v1:**

**Debounce:** 300ms after last keystroke
**Match Logic:** Case-insensitive substring search, overlapping allowed
**Data Structure:**
```typescript
interface SearchSession {
  query: string;
  matches: SearchMatch[];  // { start, end }[]
  activeIndex: number;     // -1 when no matches
}
```

**Navigation:**
- `Enter` - Next match (wraps around)
- `Shift+Enter` - Previous match (wraps around)
- Active match highlighted with `id: 'active'`
- Other matches highlighted with `id: 'other-N'`

**Reset Triggers:**
- Document change (`activeDocument.id` change)
- Search close (Esc)

**File:** `src/document/viewer/searchSession.ts`

---

**Document ↔ Graph Bridge v1:**

**NodeDocRefV1 Structure:**
```typescript
interface NodeDocRefV1 {
  refId: string;              // UUID
  docId: string;              // References ParsedDocument.id
  normVersion: 1;             // Schema version
  range: { start, end };      // Character offsets
  kind: 'label' | 'snippet' | 'citation' | 'selection';
  excerpt?: {                 // Optional validation
    text: string;             // First 32 chars
    hash: string;             // DJB2 hash of full range
  };
  createdAtMs: number;
}
```

**Where Refs Live:**
- `PhysicsNode.docRefs?: NodeDocRefV1[]`
- `PhysicsNode.primaryDocRefId?: string`

**Bridge API:**
```typescript
// src/document/bridge/docGraphBridge.ts
const bridge = createDocGraphBridge(engine, documentStore);

bridge.bindRef(nodeId, ref);       // Attach ref to node
bridge.unbindRef(nodeId, refId);  // Remove ref
bridge.getRefs(nodeId);           // Get all refs for node
bridge.getPrimaryRef(nodeId);     // Get primary ref
bridge.reveal(ref, options);      // Reveal ref in viewer
```

**Reveal Behavior:**
1. Check `ref.docId === activeDocument.id` (no cross-doc jumps)
2. Optional: validate `ref.excerpt.hash` against live text (stale detection)
3. Open viewer if in peek mode
4. Set `highlightRanges` to target range (`id: 'active'`)
5. Call `viewerApiRef.current.scrollToOffset(ref.range.start)`
6. Smooth scroll, center alignment

**Adapter Surface:**
```typescript
// src/popup/adapters.ts
interface DocumentViewerAdapter {
  scrollToPosition(charOffset: number): void;
  highlightRange(start: number, end: number): void;
  clearHighlight(): void;
  getCurrentPosition(): number;  // Stub (returns 0)
  isVisible(): boolean;
}
```

**Integration:** Real adapter created via `createDocumentViewerAdapter(documentContext)`, wired to popup/chatbar.

**Files:**
- `src/document/bridge/nodeDocRef.ts` - Types + excerpt utils
- `src/document/bridge/docGraphBridge.ts` - Bridge API
- `src/popup/adapters.ts` - Adapter implementation

---

**Event + State Choreography v1:**

**File Drop → Document Loaded:**
```
User drops file onto canvas
  ↓
GraphPhysicsPlayground.handleDrop()
  ↓
documentStore.parseFile(file)
  ↓ dispatch SET_STATUS('parsing')
Web Worker parses file
  ↓ postMessage({ type: 'PARSE_COMPLETE', document })
  ↓ dispatch SET_DOCUMENT(document)
  ↓ dispatch SET_STATUS('ready')
applyFirstWordsToNodes() binds refs
  ↓
Viewer shows document (stays in current peek/open mode)
```

**Node Click Reveal:**
```
User clicks node
  ↓
Popup opens, "Reveal in Doc" button visible
  ↓
User clicks "Reveal in Doc"
  ↓
bridge.reveal(primaryRef)
  ↓ Check docId, validate excerpt (optional)
  ↓ setViewerMode('open')
  ↓ setHighlights([{ start, end, id: 'active' }])
  ↓ viewerApiRef.current.scrollToOffset(start)
  ↓
Viewer glides open (220ms), scrolls smooth to target, highlights range
```

**Search Typing:**
```
User opens search (Ctrl+F)
  ↓ setViewerMode('open')
  ↓ setShowSearch(true)
SearchBar mounts, focuses input
  ↓
User types query
  ↓ debounce 300ms
createSearchSession(text, query)
  ↓ returns { matches, activeIndex }
  ↓ setHighlights(matches as HighlightRange[])
  ↓ scrollToOffset(matches[activeIndex].start)
  ↓
Highlights appear, active match centered
```

---

### Node Label Binding Layer

**Purpose:** Map document content to graph node labels + attach document references

**Algorithm (First 5 Words → 5 Nodes):**
```typescript
function applyFirstWordsToNodes(document: ParsedDocument, engine: PhysicsEngine) {
  const wordMatches = [...document.text.matchAll(/\S+/g)].slice(0, 5);
  const nodes = Array.from(engine.nodes.values()).slice(0, 5);
  
  nodes.forEach((node, i) => {
    const match = wordMatches[i];
    if (!match) return;
    
    const word = match[0];
    const start = match.index!;
    const end = start + word.length;
    
    // Set label
    node.label = word;
    
    // Attach NodeDocRefV1
    const ref: NodeDocRefV1 = {
      refId: generateUUID(),
      docId: document.id,
      normVersion: 1,
      range: { start, end },
      kind: 'label',
      excerpt: computeExcerpt(document.text, start, end),
      createdAtMs: Date.now(),
    };
    
    node.docRefs = [ref];
    node.primaryDocRefId = ref.refId;
  });
}
```

**Timing:**
- Applied **after** document parsing completes  
- Call site: `GraphPhysicsPlayground.tsx` `handleDrop()` callback

**Data Attached:**
- `PhysicsNode.label` - Word text for display
- `PhysicsNode.docRefs` - Array of `NodeDocRefV1` references
- `PhysicsNode.primaryDocRefId` - ID of primary ref

**File:** `src/document/nodeBinding.ts`

**AI Extension:**
- `applyAILabelsToNodes()` - Rewrite labels via AI (3-word sentences)
- Implemented, guards against stale doc changes during async AI call

---

## AI Architecture Scaffolding

**Design Goal:** Dual-mode LLM client abstraction for dev (OpenAI) vs prod (OpenRouter)

### LLMClient Interface

**Core Contract:**
```typescript
interface LLMClient {
  generateText(prompt: string): Promise<string>;
  generateStructured<T>(prompt: string, schema: object): Promise<T>;
}
```

**Implementations:**
- **OpenAIClient** (`src/ai/openaiClient.ts`) - Uses `VITE_OPENAI_API_KEY`
  - `generateText()` → Responses API (simple string output)
  - `generateStructured()` → ChatCompletions API with JSON schema response_format
- **OpenRouterClient** (`src/ai/openrouterClient.ts`) - Stub, future production proxy

**Factory:**
```typescript
// src/ai/index.ts
export function createLLMClient(config: LLMClientConfig): LLMClient {
  return config.mode === 'openai' 
    ? new OpenAIClient(config.apiKey)
    : new OpenRouterClient(config.apiKey);
}
```

### AI Label Rewriter

**Function:** `makeThreeWordLabels(words: string[]): Promise<string[]>`

**Purpose:** Convert single words → 3-word poetic sentences via AI

**Flow:**
1. Take first 5 words from document
2. Build prompt: "Convert each word into a 3-word poetic sentence..."
3. Call `client.generateStructured()` with JSON schema
4. Parse response, validate, return sentences
5. Apply to node labels via `applyAILabelsToNodes()`

**File:** `src/ai/labelRewriter.ts`

**Environment Config:**
- Dev: `VITE_OPENAI_API_KEY` in `.env.local` (Vite auto-injects as `import.meta.env.VITE_OPENAI_API_KEY`)
- Future: Proxy approach for production (hide keys server-side)

**Hardening:**
- Timeout protection (AbortController, 10s limit)
- Defensive JSON parsing
- Fallback to original words on error

**Status:** Scaffolding complete, integration in progress (not fully wired to UI yet)

---

## Popup System Architecture

**Purpose:** Node-centric UI layer for conversation-first interaction model

### Normal Popup (Current Implementation)

**Trigger:** Node press (onPointerDown when hoveredNodeId !== null)

**Specification:**
- **Size:** ~80vh height × ~20vw width (desktop), min-width 280px
- **Padding:** ≥20px internal spacing
- **Positioning:** Smart left/right placement based on node position, clamped to viewport (10px margins)
- **Animation:** Smooth fade + scale on open (200ms ease-out), opacity + transform transitions
- **Content:**
  - Header: "Node Info" + close button (X)
  - Body: Node label (3-word sentence or ID) + lorem ipsum placeholder
  - Footer: Chat input (expandable)

**Positioning Algorithm:**
```typescript
function computePopupPosition(anchor, popupWidth, popupHeight) {
  // Choose left or right
  let x = anchor.x > viewportWidth/2
    ? anchor.x - anchor.radius - GAP - popupWidth  // Left
    : anchor.x + anchor.radius + GAP;              // Right
  
  // Clamp horizontal
  x = clamp(x, 10, viewportWidth - popupWidth - 10);
  
  // Vertical center on node
  let y = anchor.y - popupHeight/2;
  y = clamp(y, 10, viewportHeight - popupHeight - 10);
  
  return { x, y };
}
```

**Edge Case Handling:**
- Drag vs click: Track pointer down position, >5px move = drag (not click)
- Outside-click close: 100ms delay after open to avoid race
- ESC key closes popup
- Switch nodes: Clicking another hovered node switches popup cleanly
- No stuck states: All state resets on close

**File Ownership:**
- `src/popup/NodePopup.tsx` - Main popup component
- `src/popup/PopupStore.tsx` - State management (React Context)
- `src/popup/popupTypes.ts` - TypeScript interfaces

---

### Chat Input (Inside Popup)

**Specification:**
- Textarea with auto-expand (1 line default → 5 lines max, ~24px per line = 120px max height)
- Border radius: 12px (2x default for premium feel)
- Send button: Custom icon (`send_icon.png`), transparent background, opacity hover effect
- Enter submits, Shift+Enter for new line
- placeholder: "Ask about this node..."

**Behavior:**
- On send: Opens `MiniChatbar` with user message + mock AI reply
- Clears input field
- Auto-resize implemented via `useEffect` + `scrollHeight` measurement

**File:** `src/popup/ChatInput.tsx`

**Future Note:**
- TODO: Smooth height animation (currently expands suddenly)
- Requires CSS `transition: height 0.2s` + state-driven height control

---

### Mini Chatbar (Companion Window)

**Specification:**
- **Size:** 300px × 400px
- **Position:** Right side of viewport, vertically centered
- **zIndex:** 1002 (above popup 1001)
- **Content:**
  - Message history (scrollable)
  - User messages: Blue bubble, right-aligned
  - AI messages: Plain text (no bubble), left-aligned, muted color
  - Input field + send icon at bottom

**Mock AI Reply:**
```
"This is a mock AI response. In the future, this will be a real AI-powered 
reply based on the node and document context."
```

**File:** `src/popup/MiniChatbar.tsx`

**Recent (Phase 6 - Membrane UI):**
- Intelligent positioning: `computeChatbarPosition()` tries 4 positions (right, left, below, above)
- Collision detection: Never overlaps popup, maintains 20px gap
- Uses `popupRect` from PopupStore for dynamic placement
- **Known bug:** Scrollbar not appearing after edge fade wrapper implementation

**Future Integration:**
- Expand to full chatbar (placeholder hook)
- Real AI responses via LLMClient
- Document viewer sync (scroll to relevant section)

---

### Popup Membrane UI (Visual Polish)

**Goal:** "Apple-level" membrane aesthetic — depth via shadow/gradient, no visible borders.

**Border Removal:**
- NodePopup: No `border` property, depth via `boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'`
- ChatInput: No borders, subtle `backgroundColor: 'rgba(99, 171, 255, 0.05)'`
- MiniChatbar: No borders, depth via shadow + backdrop filter

**Chat Input Baseline:**
- Enforced 1-line default height via `rows={1}` attribute
- Skip auto-resize for empty text to prevent 2-line default
- Smooth expansion: RAF-throttled useEffect with height transition

**Intelligent Chatbar Positioning:**
```typescript
// MiniChatbar.tsx - computeChatbarPosition()
const tryRight = () => popupRight + GAP;
const tryLeft = () => popupLeft - CHATBAR_WIDTH - GAP;
const tryBelow = () => popupBottom + GAP;
const tryAbove = () => popupTop - CHATBAR_HEIGHT - GAP;

// Priority order based on popup center position
const candidates = preferRight
  ? [tryRight, tryLeft, tryBelow, tryAbove]
  : [tryLeft, tryRight, tryBelow, tryAbove];
```

**Scrollbar Styling (`.arnvoid-scroll` class):**
- Location: `src/index.css`
- Webkit: 6px thin thumb, transparent track, blue-gray color (`rgba(99, 171, 255, 0.2)`)
- Firefox: `scrollbar-width: thin`, `scrollbar-color` fallback
- Arrow buttons: Hardened removal via `::-webkit-scrollbar-button` + `:single-button` variants
- Hover effect: Thumb brightens to 0.4 opacity

**CSS Variables:**
```css
:root {
  --panel-bg-rgb: 20, 20, 30;
  --panel-bg-opacity: 0.95;
  --scrollbar-gutter: 12px;
}
```

**Edge Fades (⚠️ Currently Broken):**
- **Design:** `.arnvoid-scroll-fades` wrapper with `::before/::after` gradient overlays
- **Behavior:** Top fade appears when `scrollTop > 8`, bottom fade when not at bottom
- **Implementation:** RAF-throttled scroll listener using `classList.toggle` (no React re-render)
- **Bug:** Wrapper `overflow: hidden` blocks scrollbar visibility
- **Debug:** See `codex-debug-brief.md` for root cause analysis

**File Ownership:**
- Popup styles: Inline constants in `NodePopup.tsx`, `ChatInput.tsx`, `MiniChatbar.tsx`
- Scrollbar CSS: `src/index.css` (`.arnvoid-scroll`, `.arnvoid-scroll-fades`)
- Positioning logic: `MiniChatbar.tsx` `computeChatbarPosition()`

---

### Seed Popup (Future Module Contract)

**Purpose:** Pluggable SVG animation system for "opening node as seed" effect

**Interface Contract:**
```typescript
interface SeedPopupModule {
  open(config: SeedPopupConfig, callbacks: SeedPopupCallbacks): void;
  close(): void;
  isOpen(): boolean;
  getCurrentPhase(): SeedPopupPhase; // 0-4
}

interface SeedPopupConfig {
  fromDot: { x, y, radius };      // Origin (node anchor)
  toRect: { x, y, width, height }; // Destination (popup rect)
  contentNode: React.ReactNode;    // Stable content to render
  theme: 'light' | 'dark';
  animationDuration?: number;      // Optional override
}

interface SeedPopupCallbacks {
  onPhaseChange?: (phase: 0|1|2|3|4) => void;
  onReadyReadable?: () => void;    // Enable pointer events at phase 4
  onClose?: () => void;
}
```

**4-Phase Animation (rAF-based, 60fps):**
1. **Phase 0-1:** Seed expansion from node
2. **Phase 2-3:** Throat elongation
3. **Phase 4:** Content reveal (readyReadable callback)

**What Arnvoid Must Provide:**
- Anchor geometry (node screen position + radius)
- Destination rect (final popup bounds)
- Stable content node (React component/element)
- Portal container (`PopupOverlayContainer`)
- Hook integration (`usePopup` for mode switching)

**File:** `src/popup/seedPopupTypes.ts` (interface definitions only, no implementation)

---

### Popup State Management

**State Shape:**
```typescript
interface PopupState {
  isOpen: boolean;
  mode: 'normal' | 'chatbar' | 'seed';  // Future: seed mode for animation
  selectedNodeId: string | null;
  anchorGeometry: { x, y, radius } | null;
  chatbarOpen: boolean;
  messages: Array<{ role: 'user' | 'ai', text: string }>;
}
```

**Actions:**
- `openPopup(nodeId, geometry)` - Opens normal popup at node
- `closePopup()` - Closes popup, resets chatbar
- `switchToNode(nodeId, geometry)` - Switch to another node
- `sendMessage(text)` - Add user message, generate mock AI reply, open chatbar
- `closeChatbar()` - Close mini chatbar window

**File:** `src/popup/PopupStore.tsx` (React Context)

---

### Geometry Provider Hook

**Purpose:** Real-time node screen geometry for popup anchoring

**Current Implementation:**
```typescript
function useAnchorGeometry(
  nodeId: string | null,
  staticGeometry: AnchorGeometry | null,
  options: { liveTracking?: boolean }
): AnchorGeometry | null
```

**Behavior:**
- Returns static geometry snapshot from popup open
- **Live tracking:** Not yet implemented (placeholder for camera/node movement updates)
- Future: Subscribe to camera/physics updates, recompute `worldToScreen` on interval

**File:** `src/popup/useAnchorGeometry.ts`

---

### Shared Overlay Container

**Purpose:** Single portal mount point for all popup modes

**Architecture:**
```tsx
<PopupOverlayContainer>
  {mode === 'normal' && <NodePopup />}
  {mode === 'seed' && <SeedPopupHost config={...} />}  // Future
  {chatbarOpen && <MiniChatbar />}
</PopupOverlay Container>
```

**Benefits:**
- Consistent z-index layering (base 1000)
- No multiple portal conflicts
- Shared `pointer-events: none` (children control their own events)

**File:** `src/popup/PopupOverlayContainer.tsx`

---

## Updated Hard Invariants

### Physics Layer
1. **Normal mode unchanged** - Visual parity with baseline
2. **Camera internal** - Never expose `cameraRef` to component
3. **Hover disc-based** - Whole node detection, not ring-only
4. **CSS pixel space** - Use `getBoundingClientRect()`, avoid DPR issues
5. **60fps physics loop** - No main-thread blocking

### Document Pipeline
6. **Worker-based parsing** - All file parsing must run off-main-thread
7. **Non-blocking UX** - Document processing never stalls physics or rendering

### Popup System
8. **No physics entanglement** - Popup UI fully independent from physics internals
9. **Overlay isolation** - Popups must not steal pointer events outside their bounds
10. **No hover breaking** - Opening popup preserves hover energy system state
11. **Modular architecture** - Normal popup and seed popup share state machine but have zero internal dependencies

### Code Quality
12. **Debuggability** - All systems have debug toggles + change-only logs
13. **Minimal diffs** - Only change what's necessary

---

## Development Workflow

**Running:**
```bash
npm run dev  # Vite dev server
```

**Environment Setup:**
```bash
# .env.local (for AI features)
VITE_OPENAI_API_KEY=sk-...
```

**Testing Document Pipeline:**
1. Drag-drop `.txt`/`.md`/`.docx`/`.pdf` onto canvas
2. Observe console logs: `[DocumentStore] parsing started`
3. Verify preview panel opens with text content
4. Check first 5 words appear as node labels

**Testing Popup System:**
1. Click a node (must be hovered first)
2. Verify big popup appears smoothly to left/right of node
3. Type in chat input, press Enter
4. Verify mini chatbar opens with mock reply
5. Click outside or press ESC to close

**Tuning Knobs:**
- Physics: `src/physics/config.ts`
- Visual: `src/visual/theme.ts`
- Popup: `src/popup/` (component-specific styles)

---

## Known Issues / Active Development

### Completed
- ✅ Document parsing pipeline (txt/md/docx/pdf)
- ✅ Web Worker integration
- ✅ Node label binding (first 5 words)
- ✅ AI label rewriting (3-word sentences via OpenAI)
- ✅ Popup system (normal mode, 4 runs complete)
- ✅ Chat input + mini chatbar
- ✅ Seed popup interface contracts
- ✅ **Document Viewer v1** (runs 1–9 complete)
  - Organ-style presence strip (spine + handle + sliver)
  - Peek/open modes with smooth glide animation
  - Independent theme (light/dark)
  - Search + highlights (debounced, with navigation)
  - Offset-based mapping (selection ↔ DOM)
  - Document ↔ graph bridge (NodeDocRefV1 + reveal)
  - Real adapter (popup/chatbar integration)
  - Virtualization (50-block threshold)

### Known Limitations (v1)
- **Legacy .doc format** - Not supported (requires server-side conversion or user upgrade to .docx)
- **Scanned/image-only PDFs** - No text extraction (no OCR)
- **Excerpt validation** - Hash checking exists but not enforced in reveal (soft validation)
- **Virtualization** - Wired but conservative threshold (50 blocks); works well for moderate docs
- **Warning dot** -Code exists but not wired to `document.warnings` display

### In Progress
- ⏳ AI loading indicator (glyph implementation parked, needs debug)

### Future Work (v1.1+)
- 🔮 Seed popup animation module implementation
- 🔮 Full chatbar expansion
- 🔮 Real AI responses in chatbar
- 🔮 Live geometry tracking for popups
- 🔮 Viewer virtualization optimization (binary-search indexing, dynamic overscan)
- 🔮 Warning UI (badge + tooltip for scanned PDF / extraction warnings)
- 🔮 Selection → node creation pipeline
- 🔮 Multi-document workspace

---

**End of System Architecture Document**
