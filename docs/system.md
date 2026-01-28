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
│   │   ├── nodeBinding.ts          ← Word→node label mapping
│   │   ├── parsers.ts              ← Unified parser adapters
│   │   └── types.ts                ← ParsedDocument interface
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
│   │ │   ├── SidebarControls.tsx
│   │   │   ├── TextPreviewButton.tsx ← Document preview toggle
│   │   │   └── TextPreviewPanel.tsx  ← Document viewer (left panel)
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
│   │   ├── adapters.ts              ← Document viewer + chatbar stubs
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
  - **Limitation:** Scanned PDFs with no embedded text → "No text extracted" warning (no OCR yet)

**UX Flow:**
1. Drag-drop file anywhere on canvas
2. File sent to Web Worker for parsing (non-blocking)
3. Progress tracked via `DocumentStore` status (idle → parsing → ready → error)
4. On completion: text available to consumers (node binding, preview UI)

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
Preview UI (TextPreviewPanel.tsx)
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
  previewOpen: boolean;  // Left panel visibility
  aiActivity: boolean;   // AI request in progress
}
```

**Actions:**
- `PARSE_START` - Set status to parsing
- `PARSE_COMPLETE` - Store document, set status to ready
- `PARSE_ERROR` - Store error message
- `TOGGLE_PREVIEW` - Show/hide preview panel
- `SET_AI_ACTIVITY` - Track AI request lifecycle

**File:** `src/store/documentStore.tsx`

**Usage:**
```typescript
const { state, parseFile, togglePreview } = useDocument();
```

---

### Preview UI ("Background Box")

**Components:**
- **TextPreviewButton** - Bottom-left toggle (20px from edges)
- **TextPreviewPanel** - Left-side slide-out panel (400px wide, full height)

**Behavior:**
- Opens automatically when document parsing completes
- Shows: filename (header), word count, full text (scrollable)
- Close button + click-outside-to-close
- Smooth slide animation (200ms ease-out)
- zIndex: 100 (above canvas, below debug/popups)

**File Ownership:**
- `src/playground/components/TextPreviewButton.tsx`
- `src/playground/components/TextPreviewPanel.tsx`

**Design Notes:**
- Non-blocking: uses separate stacking layer
- Pointer events isolated via `stopPropagation`
- No canvas interference during drag/zoom

---

### Node Label Binding Layer

** Purpose:** Map document content to graph node labels

**Algorithm (First 5 Words →5 Nodes):**
```typescript
function applyFirstWordsToNodes(text: string, engine: PhysicsEngine) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const firstFive = words.slice(0, 5);
  const nodes = Array.from(engine.nodes.values()).slice(0, 5);
  
  nodes.forEach((node, i) => {
    node.label = firstFive[i] || `Node ${i}`;
  });
}
```

**Timing:**
- Applied **after** document parsing completes  
- Reason: Avoid React async timing pitfalls, ensure stable node array
- Call site: `GraphPhysicsPlayground.tsx` `handleDrop()` callback

**Label Storage:**
- Lives directly on `PhysicsNode.label?: string`
- Rendered below node in canvas draw loop (`graphDraw.ts`)
- Horizontal rotation fix applied (labels always screen-aligned, not rotated with camera)

**File:** `src/document/nodeBinding.ts`

**Future Extension:**
- `applyAILabelsToNodes()` - Rewrite labels via AI (3-word sentences)
- Currently partially implemented, not fully wired

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

**Future Integration:**
- Extend to Main Chatbar (placeholder hook)
- Real AI responses via LLMClient
- Document viewer sync (scroll to relevant section)

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

### Document Viewer Integration (Placeholders)

**Interface Stubs:**
```typescript
interface DocumentViewerAdapter {
  scrollToPosition(charOffset: number): void;
  highlightRange(start: number, end: number): void;
  clearHighlight(): void;
  getCurrentPosition(): number;
  isVisible(): boolean;
}
```

**Future Behavior:**
- Node popup can auto-scroll document viewer to relevant section
- Mini chatbar can highlight text ranges when referencing passages
- Click references in chat → document scrolls

**File:** `src/popup/adapters.ts` (stubs log to console for now)

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

### In Progress
- ⏳ AI loading indicator (glyph implementation parked, needs debug)

### Future Work
- 🔮 Seed popup animation module implementation
- 🔮 Document viewer integration (scroll/highlight sync)
- 🔮 Full chatbar expansion
- 🔮 Real AI responses in chatbar
- 🔮 Live geometry tracking for popups

---

**End of System Architecture Document**
