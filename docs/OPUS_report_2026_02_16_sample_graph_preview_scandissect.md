# OPUS Report: Sample Graph Preview Scandissect (2026-02-16)

**Objective:** Map reality before implementing 1:1 graph runtime preview in EnterPrompt.
**Status:** Research complete. No code changes made.

---

## A. Current Preview Box Ownership

### Component Tree

```
AppShell
 └─ renderScreenContent('prompt')       // src/screens/appshell/render/renderScreenContent.tsx:122
     └─ EnterPrompt                     // src/screens/EnterPrompt.tsx:28
         └─ PromptCard                  // src/components/PromptCard.tsx:22
             └─ div[CARD_STYLE]         // :82  (full viewport, flex column)
                 └─ div[CARD_INNER_STYLE]  // :83  (720px max-width column)
                     ├─ div[GRAPH_PREVIEW_PLACEHOLDER_STYLE]  // :84  ← THE PREVIEW BOX
                     │   └─ div[PLACEHOLDER_LABEL_STYLE]      // :85  "Sample graph preview"
                     ├─ div[HEADLINE_STYLE]                    // :88  heading text
                     └─ div[INPUT_PILL_STYLE]                  // :92  textarea + buttons
```

### Key Details

| Property | Value | File:Line |
|----------|-------|-----------|
| Preview box style | `GRAPH_PREVIEW_PLACEHOLDER_STYLE` | `PromptCard.tsx:267-276` |
| Width | `100%` (inherits from 720px max-width parent) | `:268` |
| Height | `200px` (hardcoded) | `:269` |
| Border radius | `12px` | `:270` |
| Current content | Static text label only | `:85` |
| i18n key | `onboarding.enterprompt.graph_preview_placeholder` | `strings.ts:179` |

**The preview box is currently a dead placeholder div.** No graph runtime is mounted inside it.

---

## B. Graph Runtime Entrypoint + Recommended Mount Seam

### Full Graph Screen Chain

```
AppShell
 └─ renderScreenContent('graph')             // renderScreenContent.tsx:63
     └─ GraphScreenShell                     // GraphScreenShell.tsx:36  (100vh, sidebar pane layout)
         └─ GraphWithPending                 // Passed as prop, = GraphPhysicsPlayground
             = GraphPhysicsPlayground        // GraphPhysicsPlayground.tsx:5  (thin wrapper)
                 = GraphPhysicsPlaygroundContainer  // (re-export from Shell)
                     = GraphPhysicsPlaygroundShell.tsx:1491
                         ├─ DocumentProvider
                         ├─ PopupProvider
                         ├─ FullChatProvider
                         └─ GraphPhysicsPlaygroundInternal  // :121  (THE RUNTIME)
                             ├─ canvas[100%x100%]           // :1341
                             ├─ HalfLeftWindow              // :1320  (document viewer)
                             ├─ CanvasOverlays              // :1342  (debug/share/overlays)
                             ├─ AIActivityGlyph             // :1384  (portal → body)
                             ├─ PopupPortal                 // :1387  (portal → body)
                             ├─ RotationCompass             // :1388
                             └─ DebugSidebarControls        // :1463  (if enabled)
```

### Recommended Mount Seam

**`GraphPhysicsPlaygroundContainer`** (`GraphPhysicsPlaygroundShell.tsx:1491-1521`) is the correct entrypoint to reuse.

Rationale:
- It wraps all required providers (`DocumentProvider`, `PopupProvider`, `FullChatProvider`)
- It accepts `GraphPhysicsPlaygroundProps` which includes `pendingLoadInterface` for restore
- It is already exported and used as `GraphWithPending` in `renderScreenContent`
- `enableDebugSidebar={false}` disables debug UI for production

### Props (GraphPhysicsPlaygroundProps)

```typescript
// GraphPhysicsPlaygroundShell.tsx:52-68
type GraphPhysicsPlaygroundProps = {
    pendingAnalysisPayload: PendingAnalysisPayload;    // null for preview
    onPendingAnalysisConsumed: () => void;              // no-op for preview
    onLoadingStateChange?: (isLoading: boolean) => void;
    documentViewerToggleToken?: number;
    pendingLoadInterface?: SavedInterfaceRecordV1 | null;  // ← FEED SAMPLE JSON HERE
    onPendingLoadInterfaceConsumed?: () => void;
    onRestoreReadPathChange?: (active: boolean) => void;
    onSavedInterfaceUpsert?: (record: SavedInterfaceRecordV1, reason: string) => void;
    onSavedInterfaceLayoutPatch?: (...) => void;
    enableDebugSidebar?: boolean;                       // false for preview
};
```

---

## C. Sizing/Resize Mechanics + What Must Change

### How Sizing Works Today

| Mechanism | Where | Behavior |
|-----------|-------|----------|
| Container style | `CONTAINER_STYLE` (`graphPlaygroundStyles.ts:14-21`) | `width: 100%`, `height: 100%`, `overflow: hidden` — **container-relative** ✅ |
| Main div | `MAIN_STYLE` (`:23-28`) | `flex: 1`, `position: relative` — fills parent ✅ |
| Canvas element | Shell:1341 | `width: '100%'`, `height: '100%'` — fills parent ✅ |
| Surface sync | `renderLoopSurface.ts:8-68` | `canvas.getBoundingClientRect()` for CSS size, `window.devicePixelRatio` for DPR — **container-safe** ✅ |
| 0x0 guard | `graphRenderingLoop.ts:334-337` | If `rect.width <= 0 || rect.height <= 0`, skip frame and reschedule — **safe** ✅ |
| Cached rect | Shell:276-291 | `ResizeObserver` on canvas → cached into `contentRectRef` — **container-safe** ✅ |
| Engine bounds | `renderLoopSurface.ts:51` | `engine.updateBounds(rect.width, rect.height)` on resize — **auto-adapts** ✅ |

### What Uses window.* (Risks)

| Usage | File:Line | Risk for Preview |
|-------|-----------|------------------|
| `window.devicePixelRatio` | `renderLoopSurface.ts:16` | ✅ Safe — same DPR regardless of container |
| `window.addEventListener('blur')` | Shell:518, renderLoop:581 | ⚠️ Low — releases drag on blur, fine for preview |
| `window.addEventListener('keydown', capture)` | Shell:547 | ⚠️ Medium — blocks Space/Arrow for ALL instances. May conflict if two instances run |
| `window.innerWidth` / `window.innerHeight` | `CanvasOverlays.tsx:118,122,128,132,198,203` | ⚠️ Medium — share menu + narrow breakpoint use viewport size, not container |
| `window.addEventListener('resize')` | `CanvasOverlays.tsx:204,218` | ⚠️ Low — for share menu position; irrelevant if preview disables overlays |

### What Must Change

1. **Nothing for canvas rendering itself.** The canvas + render loop are already fully container-relative via `getBoundingClientRect()`.
2. **Preview container** must set explicit width/height (e.g. `width: 100%`, `height: 200px`), matching the current placeholder box.
3. **`overflow: hidden`** on preview container + `borderRadius: 12px` to clip canvas content.
4. **`pointer-events`** consideration: preview may want to be non-interactive or limited-interactive.
5. **CanvasOverlays `window.innerWidth` usage** — only matters if we show share menu / dots trigger in preview. Likely disabled for preview, so low risk.
6. **Global keydown interceptor** (Shell:525-549) — must be gated or scoped if two graph instances can coexist. See section F.

---

## D. Payload Contract + How to Load Custom JSON

### SavedInterfaceRecordV1 (The Payload Type)

```typescript
// src/store/savedInterfacesStore.ts:20-47
type SavedInterfaceRecordV1 = {
    id: string;                                        // unique id (e.g. uuid)
    createdAt: number;                                 // epoch ms
    updatedAt: number;                                 // epoch ms
    title: string;                                     // display name
    docId: string;                                     // linked document id
    source: 'paste' | 'file' | 'unknown';
    fileName?: string;
    mimeType?: string;
    parsedDocument: ParsedDocument;                     // { text, warnings, meta, ... }
    topology: Topology;                                // { nodes[], links[], springs?[] }
    analysisMeta?: SavedInterfaceAnalysisMetaV1;        // { version:1, nodesById }
    layout?: {
        nodeWorld: Record<string, { x: number; y: number }>;
    };
    camera?: {
        panX: number;
        panY: number;
        zoom: number;
    };
    preview: {
        nodeCount: number;
        linkCount: number;
        charCount: number;
        wordCount: number;
    };
    dedupeKey: string;                                 // content hash
};
```

### Required Fields (Minimum)

For the graph runtime restore path (Shell:800-900) to succeed:

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | ✅ | Guards against re-consuming same payload |
| `topology.nodes[]` | ✅ | Node specs (id, label, meta.role) |
| `topology.links[]` | ✅ | Directed edges (from, to, kind, weight) |
| `parsedDocument` | ✅ | Set in document context; must have `.text`, `.warnings[]`, `.meta{}` |
| `title` | ✅ | Set as inferred title |
| `docId` | ✅ | Used for layout patching guard |
| `layout.nodeWorld` | Optional | If present, restores exact node positions |
| `camera` | Optional | If present, restores pan/zoom |
| `analysisMeta.nodesById` | Optional | If present, populates node sourceTitle/sourceSummary |
| `preview` | ✅ (for type) | nodeCount, linkCount, charCount, wordCount |
| `dedupeKey` | ✅ (for type) | Any string |
| `source` | ✅ | 'paste', 'file', or 'unknown' |
| `createdAt`, `updatedAt` | ✅ | Epoch ms |

### Can We Load JSON Directly?

**Yes, mostly.** The restore path at Shell:800-900 consumes `pendingLoadInterface: SavedInterfaceRecordV1`, which is the exact same type used by sidebar "load interface" flow.

**Adapter needs:**
1. The JSON file must match `SavedInterfaceRecordV1` shape exactly.
2. It can be a **static import** (`import sampleData from './sample.json'`) and passed as `pendingLoadInterface` prop.
3. The existing `parseSavedInterfaceRecord()` validator (`savedInterfacesStore.ts:167`) can validate the JSON at import time.
4. No parallel "preview payload format" needed — reuse the same contract.

### DevInterfaceExportV1 vs SavedInterfaceRecordV1

The dev JSON export (Shell:91-100, `DevInterfaceExportV1`) has a **different shape** than `SavedInterfaceRecordV1`. It includes `parsedDocument` and `topology` but lacks `preview`, `dedupeKey`, `source`, `docId`, etc. An adapter or manual conversion would be needed to use dev-exported JSON as a preview payload.

**Recommendation:** Author sample JSON files in `SavedInterfaceRecordV1` format directly, or write a one-time adapter from `DevInterfaceExportV1`.

---

## E. Portal/Overlay Containment Risks

### Portal Inventory

| Component | Portal Target | z-index | Would Escape Preview? | Scoping Seam |
|-----------|--------------|---------|----------------------|--------------|
| `TooltipProvider` | `document.body` | `LAYER_TOOLTIP` | ✅ **YES** — fixed position relative to viewport | Could accept optional `portalRoot` prop |
| `PopupOverlayContainer` | `document.body` | `1000` | ✅ **YES** — fixed full-screen overlay | Could accept optional `portalRoot` prop |
| `AIActivityGlyph` | `document.body` | `9999` | ✅ **YES** — fixed position bottom-left | Could accept optional `portalRoot` or skip in preview mode |
| `LoginOverlay` | `document.body` | (from overlay) | ✅ **YES** — full-screen login modal | Not relevant for preview (EnterPrompt-only) |

### Inline Overlays (No Portal, Render Inside Container)

| Component | Behavior | Escape Risk |
|-----------|----------|-------------|
| `HalfLeftWindow` | Flex child of container div | ❌ No escape — but takes 30% width; inappropriate for small preview |
| `CanvasOverlays` | `position: absolute` inside `MAIN_STYLE` div | ❌ No escape if parent has `overflow: hidden` |
| `RotationCompass` | Positioned inside container | ❌ No escape |
| `DebugSidebarControls` | Flex child inside container | ❌ No escape — disabled via `enableDebugSidebar={false}` |
| `SessionExpiryBanner` | Inside main div | ❌ No escape |

### Analysis

**For preview mode**, the 4 portal-to-body components are the main risk. Each would render at the viewport level, NOT inside the preview box.

**Recommended approach:**
1. **Disable popups/tooltips/chat in preview mode** — simplest. Add a `previewMode?: boolean` prop that suppresses popup/tooltip rendering.
2. **Or scope portals** — pass a container ref as `portalRoot` to each provider. More work, enables 1:1 interactive preview.
3. **AIActivityGlyph** — suppress in preview (preview doesn't run AI analysis).
4. **HalfLeftWindow** — suppress in preview (no document viewer needed).

---

## F. Performance / Multi-Instance Risks

### Render Loop Cost

Each graph instance runs:
- `requestAnimationFrame` loop at 60fps
- Physics engine `step()` per frame (with scheduler)
- Canvas 2D draw calls per frame (nodes, links, labels, vignette)
- Hover hit-test up to 10Hz

On a typical machine, one instance uses ~3-8ms/frame. Two instances would double GPU/CPU canvas work.

### Multi-Instance Concerns

| Concern | Severity | Detail |
|---------|----------|--------|
| Two rAF loops | ⚠️ Medium | Both run at 60fps, doubling canvas work |
| Two physics engines | ⚠️ Medium | Each has its own `PhysicsEngine` instance — independent, no shared state |
| Global keydown interceptor | 🔴 High | Shell:525-549 registers `window.addEventListener('keydown', capture)` — both instances would intercept Space/Arrow keys |
| Global surface generation | ⚠️ Medium | `graphRenderingLoop.ts:83` has a module-level `globalSurfaceGeneration` counter shared across instances |
| window blur listener | ⚠️ Low | Both instances would clear hover on blur — benign |
| `window.__engine` (dev-only) | ⚠️ Low | Second instance would overwrite first on `window.__engine` |
| DocumentProvider / PopupProvider / FullChatProvider | ✅ Safe | Each `GraphPhysicsPlaygroundContainer` creates its own provider tree |

### Typing Performance

If preview runs while user types on EnterPrompt:
- Canvas rAF loop runs continuously (even for static graph)
- Could consume 3-8ms per 16ms frame budget
- Textarea input events are DOM, not canvas — no direct conflict
- **Mitigation:** Preview could reduce frame rate (skip frames if idle) or pause physics when graph is settled

### Multi-Instance Strategy (Recommendations)

1. **Unmount preview on transition to graph screen.** This is the simplest approach — only one instance exists at any time.
2. **Alternatively:** Pause preview render loop when not visible (e.g. IntersectionObserver, or explicit `paused` prop).
3. **Global keydown interceptor** — must be deduplicated or scoped. Options:
   - Gate with a `hasFocus` ref per instance
   - Move interceptor to a shared module that only the "active" graph instance activates
4. **Global surface generation** — create per-instance counter to avoid false invalidation.

---

## G. Recommended Implementation Plan (Steps Only)

1. **Create `SampleGraphPreview` wrapper component**
   - Renders `GraphPhysicsPlaygroundContainer` inside a sized `div` (matching `GRAPH_PREVIEW_PLACEHOLDER_STYLE` dimensions)
   - Passes `enableDebugSidebar={false}`, `pendingAnalysisPayload={null}`, `onPendingAnalysisConsumed={noop}`
   - Passes sample JSON as `pendingLoadInterface`
   - Sets `overflow: hidden`, `borderRadius: 12px` on container

2. **Author sample JSON file**
   - Create `src/assets/sampleInterface.json` (or similar) in `SavedInterfaceRecordV1` format
   - Include nodes, links, layout, camera, analysisMeta for a representative graph
   - Validate with `parseSavedInterfaceRecord()` at import

3. **Replace placeholder in PromptCard**
   - Swap `GRAPH_PREVIEW_PLACEHOLDER_STYLE` div (lines 84-86) with `<SampleGraphPreview />`
   - Keep same outer dimensions

4. **Handle portal containment**
   - Option A (simpler): Add `previewMode` flag to suppress AIActivityGlyph, PopupPortal, HalfLeftWindow, and tooltip interactions
   - Option B (1:1): Scope portals to container root via prop

5. **Handle multi-instance safety**
   - Gate global keydown interceptor with focus/visibility check
   - Ensure unmount on screen transition (likely automatic since PromptCard unmounts when navigating to graph)

6. **Resize support (future)**
   - Canvas already adapts to container size via `getBoundingClientRect()` + `ResizeObserver`
   - Just change the container div's CSS dimensions and the graph adapts automatically
   - Test with dynamic height changes

7. **Performance gating (if needed)**
   - Add idle-detection to reduce frame rate when graph is settled
   - Or pause render loop when preview is not in viewport

---

## Appendix: Search Notes

Key searches performed:
- `rg "Sample Graph Preview|sample graph|preview" src/` → found placeholder in PromptCard.tsx:84-86
- `rg "createPortal" src/` → 4 sites: TooltipProvider, PopupOverlayContainer, AIActivityGlyph, LoginOverlay
- `rg "getBoundingClientRect" src/playground/` → 11 hits, all use canvas/container rect (container-safe)
- `rg "ResizeObserver" src/` → 1 site: Shell:287 on canvas
- `rg "window.inner" src/playground/` → only CanvasOverlays.tsx (share menu positioning)
- `rg "window.addEventListener" src/playground/` → blur, keydown, resize, scroll, pointerdown
- `rg "SavedInterfaceRecordV1" src/` → 50+ refs, type defined in savedInterfacesStore.ts:20
- `fd GraphWithPending` → not a file, it's a prop name (`renderScreenContent.tsx:17`)
- `rg "globalSurfaceGeneration" src/` → graphRenderingLoop.ts:83 (module-level shared counter)

### Exact File Paths Referenced

| File | Purpose |
|------|---------|
| `src/components/PromptCard.tsx` | Preview box owner (L84-86, L267-276) |
| `src/screens/EnterPrompt.tsx` | Screen that renders PromptCard |
| `src/screens/appshell/render/renderScreenContent.tsx` | Screen router |
| `src/screens/appshell/render/GraphScreenShell.tsx` | Graph screen layout shell |
| `src/playground/GraphPhysicsPlayground.tsx` | Thin wrapper → Container |
| `src/playground/GraphPhysicsPlaygroundShell.tsx` | Main runtime (1522 lines) |
| `src/playground/modules/GraphPhysicsPlaygroundContainer.tsx` | Re-export |
| `src/playground/graphPlaygroundStyles.ts` | Container/main styles |
| `src/playground/useGraphRendering.ts` | Hook that starts render loop |
| `src/playground/rendering/graphRenderingLoop.ts` | rAF render loop |
| `src/playground/rendering/renderLoopSurface.ts` | Canvas surface sync |
| `src/store/savedInterfacesStore.ts` | SavedInterfaceRecordV1 type |
| `src/ui/tooltip/TooltipProvider.tsx` | Portal → body |
| `src/popup/PopupOverlayContainer.tsx` | Portal → body |
| `src/popup/PopupPortal.tsx` | Popup rendering |
| `src/playground/components/AIActivityGlyph.tsx` | Portal → body |
| `src/playground/components/CanvasOverlays.tsx` | window.innerWidth usage |
| `src/playground/components/HalfLeftWindow.tsx` | Document viewer (inline) |
| `src/auth/LoginOverlay.tsx` | Portal → body |
