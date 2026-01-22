# Handoff Document: Graph Physics + Document Pipeline + Popup System

**Last Updated:** 2026-01-21  
**Status:** Phase 6 in progress (Popup Membrane UI - 11 runs complete, edge fades wiring issue), Document pipeline stable, AI scaffolding ready  
**Next Developer:** Claude Sonnet

---

## 1. Project Snapshot

### What This Is
Force-directed graph physics playground with document ingestion pipeline and conversation-first node interaction model.

**Core Systems:**
1. **Physics Engine** - Force-directed graph simulation (unchanged from baseline)
2. **Visual Layer** - Two themes (normal/elegant v2) with hover energy system  
3. **Document Pipeline** - Parse txt/md/docx/pdf → bind to node labels
4. **AI Scaffolding** - Dual-mode LLM client (OpenAI/OpenRouter) for label rewriting
5. **Popup System** - Node-centric UI (normal popup + chat + future seed module)

### What Changed In This Chat Arc

**Document ingestion phase:**
- Implemented unified parser for txt/md/docx/pdf
- Web Worker isolation (off-main-thread parsing)
- Document store (React Context) with viewerMode
- Document Viewer v1 (presence strip, peek/open, search, highlights)
- Node label binding (first 5 words + NodeDocRefV1)
- Document ↔ Graph Bridge (reveal in doc)

**AI architecture phase:**
- LLMClient interface (generateText, generateStructured)
- OpenAI/OpenRouter adapters
- Label rewriter (`makeThreeWordLabels()`)
- Environment config (`VITE_OPENAI API_KEY`)
- Timeout protection +defensive parsing

**Popup system phase (4 runs):**
- **Run 1:** Popup rails (state, portal, basic layout)
- **Run 2:** Smart positioning + smooth animations + outside-click close
- **Run 3:** Chat input (5-line expansion) + mini chatbar (mock AI replies)
- **Run 4:** Seed popup interface contract + geometry provider + doc viewer stubs

**Popup membrane UI phase (11 runs):**
- **Run 1-3:** Border purge + 1-line textarea baseline + smooth expansion
- **Run 4:** Intelligent chatbar positioning (adjacent to popup, collision-aware)
- **Run 5-6:** Overlap fix + true 1-line textarea enforcement
- **Run 7-8:** Scrollbar gutter + arnvoid scrollbar styling
- **Run 9-11:** Hardened arrow removal + edge fades + thumb polish
- **Known issue:** Edge fade wiring broken (scrollbar not appearing after wrapper implementation)

**Document Viewer v1 (9 runs):**
- **Run 1-3:** State management, theming, basic layout (Dock Strip, Panel)
- **Run 4-6:** Selection mapping, search debouncing, highlight rendering
- **Run 7-9:** Virtualization scaffolding, bridge wiring (NodeDocRefV1), real adapters

---

## 2. Quick Start

### Installation
```bash
npm install
```

### Environment Setup (Optional - for AI features)
```bash
# Create .env.local
VITE_OPENAI_API_KEY=sk-...
```

### Run
```bash
npm run dev
```

**Dev server:** `http://localhost:5173`

### First-Time Verification
1. Page loads → graph spawns 5 nodes
2. Hover nodes → smooth color transition (dark → bright blue)
3. Drag `.txt` file onto canvas → viewer opens via handle strip
4. Click a node → big popup appears
5. Type in chat input → mini chatbar opens

---

## 3. Feature Verification Checklist

### Document Pipeline

**Plain text (.txt / .md):**
- [ ] Drag-drop `.txt` file onto canvas
- [ ] Console shows: `[DocumentStore] Parsing started`
- [ ] Left presence strip indicates doc loaded (blue dot)
- [ ] Click handle/spine → Viewer opens (smooth glide)
- [ ] Viewer shows filename, word count, full text (quicksand/system font)
- [ ] First 5 words appear as labels on nodes
- [ ] Ctrl+Enter/Esc toggles viewer peek/open

**Word documents (.docx):**
- [ ] Drag-drop `.docx` file
- [ ] Parsing completes (may take 1-2s for large files)
- [ ] Text extracted correctly (paragraphs preserved)
- [ ] First 5 words → node labels

**PDF files (.pdf):**
- [ ] Drag-drop text-based PDF
- [ ] Text extraction succeeds
- [ ] First 5 words → node labels

**Scanned PDF edge case:**
- [ ] Drag-drop scanned PDF (image-only, no embedded text)
- [ ] Warning appears: "No text extracted" (or equivalent)
- [ ] No crash, graceful degradation

**Worker isolation:**
- [ ] During parsing, physics loop continues at 60fps
- [ ] No UI freezes or stalls
- [ ] Hover/camera still work during parsing

---

### Popup System

**Basic popup behavior:**
- [ ] Click a hovered node → big popup opens
- [ ] Popup appears smoothly (fade + scale animation, not brick)
- [ ] Popup positioned left **or** right of node (smart placement)
- [ ] Popup stays fully on-screen (10px margins, no clipping)
- [ ] Popup width: ~20vw (min 280px)
- [ ] Popup height: ~80vh
- [ ] Internal padding: ≥20px (comfortable spacing)

**Popup content:**
- [ ] Header: "Node Info" + close X button
- [ ] Body: Node label (3-word sentence or ID fallback)
- [ ] Body: Lorem ipsum placeholder text
- [ ] Footer: Chat input field

**Closing:**
- [ ] Click X button → popup closes smoothly
- [ ] Press Escape → popup closes
- [ ] Click outside popup → popup closes
- [ ] Outside-click has 100ms delay (no race with opening click)

**Node switching:**
- [ ] Popup open on node A
- [ ] Click hovered node B → popup switches to B cleanly
- [ ] No double popups, no stuck states

**Edge cases:**
- [ ] Drag node (>5px movement) → popup does NOT open
- [ ] Click node with camera moving → no crash
- [ ] Open popup → physics/hover still work normally
- [ ] Click "Reveal in Doc" → viewer opens, scrolls to reference, highlights text

---

### Chat Input (Inside Popup)

**Auto-expansion:**
- [ ] Input starts at 1 line height (~24px)
- [ ] Type text → input expands line-by-line
- [ ] Max 5 lines (~120px), then scrolls
- [ ] Delete text → input shrinks back

**Send button:**
- [ ] Icon image displays (send_icon.png)
- [ ] Hover → opacity increases, scale grows
- [ ] Click sends message
- [ ] Enter key sends message
- [ ] Shift+Enter creates new line (does NOT send)

**Note:** Auto-expansion animation is sudden (not smooth). Future improvement: CSS transition for height.

---

### Mini Chatbar

**Opening:**
- [ ] Type message in popup chat input
- [ ] Press Enter or click send
- [ ] Mini chatbar window opens on right side of viewport
- [ ] User message appears in blue bubble (right-aligned)
- [ ] Mock AI reply appears immediately (left-aligned, no bubble)

**Chatbar UI:**
- [ ] Size: 300px × 400px
- [ ] Position: Right side, vertically centered
- [ ] Message history scrolls
- [ ] Input field at bottom
- [ ] Send icon button

**Continuation:**
- [ ] Type another message in chatbar input
- [ ] Press Enter → message appends to history
- [ ] Mock AI reply appends
- [ ] Scroll stays at bottom (auto-scroll)

**Closing:**
- [ ] Click X button in chatbar → closes
- [ ] Chatbar independent from popup (can close separately)

---

### Popup Membrane UI (Visual Polish)

**Border removal:**
- [ ] Node popup has no visible borders (depth via shadow only)
- [ ] Chat input has no borders (subtle background only)
- [ ] Mini chatbar has no borders

**Chat input baseline:**
- [ ] Empty chat input = exactly 1 line tall (~40px)
- [ ] Type text → expands smoothly line by line
- [ ] Clear text → shrinks back to 1 line

**Intelligent chatbar positioning:**
- [ ] Chatbar appears adjacent to popup (left or right side)
- [ ] Maintains 20px gap from popup
- [ ] Never overlaps popup content
- [ ] Stays fully on-screen (viewport clamping)
- [ ] Tries 4 positions: right, left, below, above (in preference order)

**Scrollbar styling:**
- [ ] Scrollbar is thin (6px), blue-gray color
- [ ] **⚠️ KNOWN BUG:** Scrollbar not appearing (edge fade wrapper issue)
- [ ] Arrow buttons removed (should have no up/down arrows)
- [ ] Thumb brightens on hover

**Edge fades (currently broken):**
- [ ] **⚠️ NOT WORKING:** Top/bottom gradient fades should appear based on scroll position
- [ ] **Issue:** Wrapper with `overflow: hidden` blocking scrollbar visibility
- [ ] **Debug guide:** See `codex-debug-brief.md` for diagnosis

---

## 4. Where to Modify Things

### Document Parsing

**Add new file format:**
1. Create adapter in `src/document/parsers.ts`
2. Add MIME type detection to `createFileParser()`
3. Update `sourceType` union in `src/document/types.ts`
4. Update worker message handling in `src/workers/documentWorker.ts`

**Change parsing logic:**
- Edit adapter functions in `src/document/parsers.ts`
- Example: `parseTxt()`, `parseDocx()`, `parsePdf()`

**Modify Document Viewer:**
- Presence/Shell: `src/document/viewer/DocumentDockStrip.tsx`, `DocumentViewerPanel.tsx`
- Content/Blocks: `src/document/viewer/DocumentContent.tsx`, `DocumentBlock.tsx`
- Logic: `src/document/viewer/documentModel.ts`, `searchSession.ts`

---

### Node Label Binding

**Change word count:**
```typescript
// src/document/nodeBinding.ts
const firstFive = words.slice(0, 10);  // Change 5 → 10
const nodes = Array.from(engine.nodes.values()).slice(0, 10);
```

**AI label rewriting:**
- Wire up `applyAILabelsToNodes()` in `GraphPhysicsPlayground.tsx` `handleDrop()`
- Currently partially implemented, needs final integration

---

### Popup Components

**Normal popup:**
- Main component: `src/popup/NodePopup.tsx`
- State: `src/popup/PopupStore.tsx`
- Types: `src/popup/popupTypes.ts`
- Styling: Inline constants (POPUP_STYLE, HEADER_STYLE)
- **Recent:** Borders removed, uses boxShadow for depth

**Chat input:**
- Component: `src/popup/ChatInput.tsx`
- Styling: All inline (TEXTAREA_STYLE, SEND_BUTTON_STYLE constants)
- **Recent:** `rows={1}` attribute, smooth height transition, overflow handling

**Mini chatbar:**
- Component: `src/popup/MiniChatbar.tsx`
- Mock reply text: Search for `"This is a mock AI response..."`
- **Recent:** Intelligent positioning via `computeChatbarPosition()`, collision detection
- **Known bug:** Scrollbar not visible after edge fade wrapper implementation

**Scrollbar styling:**
- Global CSS: `src/index.css` — `.arnvoid-scroll` class
- CSS vars: `--panel-bg-rgb`, `--panel-bg-opacity`, `--scrollbar-gutter`
- Effect: Thin (6px), blue-gray, no arrow buttons
- **Known bug:** `.arnvoid-scroll-fades` wrapper with `overflow: hidden` breaks scrollbar visibility

**Seed popup (future):
- Interface: `src/popup/seedPopupTypes.ts`
- Implementation: Not yet created (contract only)

**Document viewer integration:**
- File: `src/popup/adapters.ts` (Real adapter)
- Bridge: `src/document/bridge/docGraphBridge.ts`
- Usage: `bridge.reveal(ref)`

---

### AI Client

**Switch mode:**
```typescript
// src/ai/index.ts
const client = createLLMClient({
  mode: 'openrouter',  // Change from 'openai'
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY
});
```

**Change prompts:**
- Edit `makeThreeWordLabels()` in `src/ai/labelRewriter.ts`

**Add new AI function:**
1. Create function in `src/ai/` folder
2. Use `createLLMClient()` to get client
3. Call `client.generateText()` or `client.generateStructured()`

---

## 5. Known Issues / TODO

### Current Bugs
- **AI loading glyph:** Implementation attempted but glyph not visible (debug needed)
  - State updates correctly (`aiActivity: true/false`)
  - Component mounts via `createPortal`
  - CSS animation defined
  - **Issue:** Dot never appears on screen (z-index/position/rendering issue)
  - **Debug brief:** `glyph-debug-brief.md` created for investigation

### Placeholder/Stub Status
- **Seed popup animation:** Interface defined, no implementation

- **Full chatbar expansion:** Stub only (expandToFull, collapseToMini)
- **Live anchor geometry:** Hook exists, live tracking not implemented

### Future Improvements / v1.1
- **Real Virtualization:** Enable threshold <50 blocks, add spacer divs
- **Excerpt Validation:** Enforce hash check in reveal()
- **Warning UI:** Show amber dot for warnings (scanned PDFs)
- **Chatbar Integration:** Wire "cite" clicks to doc viewer reveal
- **Seed popup module:** Implement 4-phase rAF animation system

---

## 6. Testing Matrix

### Document Formats

| Format | File | Expected Result | Status |
|--------|------|-----------------|--------|
| Plain text | `test-document.txt` | Preview + 5 labels | ✅ |
| Markdown | `README.md` | Preview + 5 labels | ✅ |
| Word | `sample.docx` | Preview + 5 labels | ✅ |
| PDF (text) | `paper.pdf` | Preview + 5 labels | ✅|
| PDF (scanned) | `scan.pdf` | Warning, no crash | ⚠️ (degraded) |

### Popup Scenarios

| Scenario | Expected | Status |
|----------|----------|--------|
| Click node | Popup opens at smart position | ✅ |
| Click outside | Popup closes | ✅ |
| ESC key | Popup closes | ✅ |
| Switch nodes | Popup switches cleanly | ✅ |
| Drag node | Popup does NOT open | ✅ |
| Chat input expand | 1→5 lines, then scroll | ✅ |
| Send message | Chatbar opens with reply | ✅ |

### Edge Cases

| Case | Expected | Status |
|------|----------|--------|
| Drop file during popup | No crash, popup stays | ✅ |
| Open popup during AI call | No crash, independent | ✅ |
| Multiple rapid clicks | No double popups | ✅ |
| Hover break | Hover energy preserved | ✅ |
| Physics loop | 60fps maintained | ✅ |

---

## 7. Multi-Run Development Model

This project evolves in discrete runs (not monolithic features):

### Completed Runs

**Document pipeline:**
- Run 1: File drop + worker + store + viewer UI foundation
- Run 2: Node binding (first 5 words)

**AI scaffolding:**
- Run 1: LLMClient interface + OpenAI adapter
- Run 2: Label rewriter + timeout protection

**Popup system (Phase 5):**
- Run 1: State + portal + basic layout
- Run 2: Smart positioning + animations
- Run 3: Chat input + mini chatbar
- Run 4: Seed popup contract + stubs

### Next Runs (Suggestions)

**Document Viewer Polish (v1.1):**
- Run 1: Implement spacers in `useVirtualBlocks` to fix scrollbar height
- Run 2: Wire warning dot to `document.warnings`
- Run 3: Hardened excerpt validation in `docGraphBridge`

**AI integration:**
- Run 1: Wire label rewriting to UI button
- Run 2: Real chatbar responses via LLMClient
- Run 3: Context-aware prompts (node + document)

**Seed popup module:**
- Run 1: SVG overlay + phase 0-1 (seed expand)
- Run 2: Phase 2-3 (throat elongate)
- Run 3: Phase 4 (content reveal)
- Run 4: Callbacks + integration

---

## 8. File Map (Quick Reference)

### Core Layers

**Physics:**
- `src/physics/engine.ts` - Main simulation
- `src/physics/forces.ts` - Force application
- `src/physics/engine/velocity/*.ts` - Velocity passes

**Visual:**
- `src/visual/theme.ts` - Theme config
- `src/playground/useGraphRendering.ts` - Render orchestrator
- `src/playground/rendering/*.ts` - Modularized rendering

**Document:**
- `src/document/parsers.ts` - Format adapters
- `src/document/nodeBinding.ts` - Word→label mapping
- `src/document/types.ts` - ParsedDocument interface
- `src/workers/documentWorker.ts` - Off-thread parsing
- `src/store/documentStore.tsx` - State management

**AI:**
- `src/ai/index.ts` - Factory + exports
- `src/ai/clientTypes.ts` - LLMClient interface
- `src/ai/openaiClient.ts` - OpenAI adapter
- `src/ai/labelRewriter.ts` - 3-word sentence generator

**Popup:**
- `src/popup/PopupStore.tsx` - State context
- `src/popup/NodePopup.tsx` - Main popup
- `src/popup/ChatInput.tsx` - Expandable input
- `src/popup/MiniChatbar.tsx` - Chat window
- `src/popup/seedPopupTypes.ts` - Future contract
- `src/popup/adapters.ts` - Doc viewer stubs

**UI Components:**
- `src/document/viewer/*` (All viewer components)
- `src/playground/components/AIActivityGlyph.tsx` (parked)
- `src/playground/components/CanvasOverlays.tsx`

---

## 9. Debug Commands

### Enable Document Parsing Logs
```typescript
// In src/store/documentStore.tsx, add console.log to reducer:
case 'PARSE_COMPLETE':
  console.log('[DocumentStore] Parse complete:', action.document);
```

### Test Document Formats
```bash
# Create test files
echo "Hello world testing document pipeline" > test.txt
# Drag test.txt onto canvas
```

### Enable Popup Debug Logs
```typescript
// In src/popup/PopupStore.tsx, logs already exist:
console.log('[Popup] Opening for node:', nodeId);
console.log('[Popup] Sending message:', text);
```

### Verify Worker Communication
```typescript
// In src/workers/documentWorker.ts:
console.log('[Worker] Received message:', event.data.type);
console.log('[Worker] Posting result:', result);
```

---

## 10. Acceptance Criteria Summary

**Before deploying:**
- [ ] All document formats parse without main-thread stall
- [ ] Node labels update after parsing completes
- [ ] Popup opens on click, positions smartly, never clips off-screen
- [ ] Chat input expands/shrinks smoothly (or note: animation TODO)
- [ ] Mini chatbar shows messages correctly
- [ ] No console errors or React warnings
- [ ] Physics maintains 60fps during all operations
- [ ] Hover energy system unaffected by popup
- [ ] No memory leaks (close/reopen popup multiple times)

**Code quality:**
- [ ] TypeScript strict mode passes
- [ ] No unused imports
- [ ] Console logs only on state changes (no spam)
- [ ] Comments explain "why", not "what"

---

## 11. Critical Patterns

### Worker Pattern (Document Parsing)
```typescript
// Send to worker
worker.postMessage({
  type: 'PARSE_FILE',
  file: fileData,
  fileName: file.name
});

// Handle response
worker.onmessage = (e) => {
  if (e.data.type === 'PARSE_COMPLETE') {
    dispatch({ type: 'PARSE_COMPLETE', document: e.data.document });
  }
};
```

### Node Label Binding
```typescript
// After document ready
const words = document.text.split(/\s+/).filter(w => w.length > 0);
const firstFive = words.slice(0, 5);
const nodes = Array.from(engine.nodes.values()).slice(0, 5);

nodes.forEach((node, i) => {
  node.label = firstFive[i] || `Node ${i}`;
});
```

### Popup State Management
```typescript
// Open popup
const { openPopup } = usePopup();
openPopup(nodeId, {
  x: screenPos.x,
  y: screenPos.y,
  radius: screenRadius
});

// Send message
const { sendMessage } = usePopup();
sendMessage("What is this node about?");
// → Opens chatbar with user msg + mock AI reply
```

### Smart Positioning
```typescript
// Choose left or right
if (anchor.x > viewportWidth / 2) {
  // Node on right → popup on left
  x = anchor.x - anchor.radius - GAP - popupWidth;
} else {
  // Node on left → popup on right
  x = anchor.x + anchor.radius + GAP;
}

// Clamp to viewport
x = Math.max(10, Math.min(x, viewportWidth - popupWidth - 10));
```

---

## 12. Known Gotchas

### Document Parsing
- **Scanned PDFs:** pdf.js can't extract text from images (OCR not included)
- **Large files:** DOCX >10MB may take 2-3s to parse (worker prevents UI freeze)
- **Worker errors:** Always wrapped in try/catch, error posted back to main thread

### Popup System
- **Drag vs click:** Movement >5px triggers drag mode (popup won't open)
- **Outside-click timing:** 100ms delay after open to avoid race
- **Geometry snapshots:** Popup uses static anchor from open time (not live-tracked yet)

### AI Client
- **API keys:** Must be in `.env.local` with `VITE_` prefix (Vite requirement)
- **Timeout:** AbortController set to 10s (adjust in `labelRewriter.ts`)
- **Structured output:** Requires ChatCompletions API, not Responses API

### React State
- **Async timing:** Always wait for document parse completion before binding labels
- **Ref access:** Physics engine lives in ref, not state (avoid re-render triggers)

---

**End of handoff. Document pipeline + Popup system ready for next phase! 🚀**


---

## Document Viewer v1 + Bookmark Tab (Current State)

### What Is Now True
- Viewer width is controlled by a single knob: `--dv-panel-scale` in `src/index.css`.
- Panel width and tab position both derive from `--panel-width`.
- Horizontal scroll in the viewer is forbidden and actively enforced.
- Sheet width is always smaller than panel width (breathing room).

### Regression Traps (Do Not Break)
- Do not remove or override `overflow-x: hidden` in `.dv-content`.
- Do not decouple tab `left` from `--panel-width`.
- Do not set `docTheme.maxLineWidth` to a fixed value that ignores `--dv-sheet-width`.
- Do not reduce `min-width: 0` on viewer flex children.

### Debug Pointers
- Panel/tab width mismatch: `src/index.css`, `src/PresenceStrip/PresenceStrip.css`.
- Horizontal scroll or clipping: `src/document/viewer/viewerTokens.css`.
- Sheet width rules: `src/index.css`, `src/document/viewer/docTheme.ts`.

