# Scandissect V2: Sample Graph Preview – Exhaustive Forensic Report

**Date:** 2026-02-16
**Goal:** Map every dependency, global, portal, listener, and singleton the graph runtime touches, so we can embed it 1:1 inside EnterPrompt with zero drift.
**Status:** Research only. No code changes.

---

## A. Full Dependency + Provider Map

### Provider Chain (Container → Internal)

The public mount seam is `GraphPhysicsPlaygroundContainer` at [GraphPhysicsPlaygroundShell.tsx:1491-1521](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1491-L1521):

```
GraphPhysicsPlaygroundContainer  (exported, accepts GraphPhysicsPlaygroundProps)
 ├─ DocumentProvider              src/store/documentStore.tsx:87
 │   └─ React context (useReducer) — per-instance ✅
 │   └─ Creates WorkerClient on mount (web worker for parsing) — per-instance ✅
 │
 ├─ PopupProvider                 src/popup/PopupStore.tsx:23
 │   └─ React context (useState) — per-instance ✅
 │   └─ Calls generateResponseAsync (async AI) — per-instance ✅
 │
 ├─ FullChatProvider              src/fullchat/FullChatStore.tsx:27
 │   └─ React context (useState) — per-instance ✅
 │
 └─ GraphPhysicsPlaygroundInternal    Shell.tsx:121
     ├─ useGraphRendering hook        src/playground/useGraphRendering.ts:45
     │   └─ All state via useRef (camera, hover, settings, renderScratch) — per-instance ✅
     │   └─ Calls startGraphRenderLoop(deps) — creates rAF loop bound to canvas
     │   └─ Creates createHoverController({refs}) — per-instance ✅
     │
     ├─ PhysicsEngine (useRef)       Shell.tsx:126
     │   └─ new PhysicsEngine() — per-instance ✅
     │
     ├─ topologyControl              IMPORT: src/graph/topologyControl.ts
     │   └─ ⚠️ MODULE-LEVEL SINGLETON — see section D
     │
     └─ Rendered children:
         ├─ canvas                   Shell.tsx:1341  (100%×100%, rendering target)
         ├─ HalfLeftWindow           Shell.tsx:1320  (doc viewer, inline flex child)
         ├─ CanvasOverlays           Shell.tsx:1342  (debug/share UI, position:absolute)
         ├─ AIActivityGlyph          Shell.tsx:1384  (portal → body)
         ├─ PopupPortal              Shell.tsx:1387  (portal → body)
         ├─ RotationCompass          Shell.tsx:1388  (inline)
         ├─ DebugSidebarControls     Shell.tsx:1463  (conditional, enableDebugSidebar)
         ├─ FullChatToggle           Shell.tsx:1459  (conditional, FULLCHAT_ENABLED)
         ├─ FullChatbar              Shell.tsx:1482  (conditional)
         ├─ LoadingScreen            Shell.tsx:1315  (returned instead of canvas when loading)
         └─ TestBackend              Shell.tsx:1383  (conditional)
```

### Minimal Embed Contract

| Requirement | Detail |
|-------------|--------|
| **Required props** | `pendingAnalysisPayload` (null for preview), `onPendingAnalysisConsumed` (noop), `enableDebugSidebar` (false) |
| **Optional props** | `pendingLoadInterface` (SavedInterfaceRecordV1), all `on*` callbacks (can be noop) |
| **Required wrappers** | None external — Container creates its own DocumentProvider, PopupProvider, FullChatProvider |
| **Required DOM** | Container div with explicit width + height (canvas fills parent via 100%×100%) |
| **Non-optional side effects** | rAF loop starts immediately on canvas mount; Shell keydown interceptor fires globally; render loop dispatches `graph-render-tick` custom event on `window`; `topologyControl` singleton is mutated |

### Global Assumptions Each Provider Makes

| Provider | Global assumption | Risk |
|----------|-------------------|------|
| `DocumentProvider` | Creates `WorkerClient` (web worker) | Per-instance, but worker is a real resource |
| `PopupProvider` | Calls `generateResponseAsync` (AI backend) | Per-instance, but network calls if user clicks node |
| `FullChatProvider` | Manages chat state | Per-instance, isolated |
| `useGraphRendering` | `window.devicePixelRatio` for DPR | Safe (same across instances) |

---

## B. Exhaustive Escape Hatch Inventory

### B.1 — createPortal Sites (Complete List)

| # | Component | File:Line | Portal Target | Renders | Must Contain in Preview? |
|---|-----------|-----------|---------------|---------|-------------------------|
| 1 | `TooltipPortal` | [TooltipProvider.tsx:219-224](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/ui/tooltip/TooltipProvider.tsx#L219-L224) | `document.body` | Tooltip bubble (position:fixed) | ⚠️ Only if tooltips needed in preview |
| 2 | `PopupOverlayContainer` | [PopupOverlayContainer.tsx:31](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/PopupOverlayContainer.tsx#L31) | `document.body` | NodePopup + MiniChatbar (position:fixed) | ⚠️ Only if node click → popup in preview |
| 3 | `AIActivityGlyph` | [AIActivityGlyph.tsx:59](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/AIActivityGlyph.tsx#L59) | `document.body` | Tiny dot pulse (position:fixed, z:9999) | ❌ Preview doesn't run AI |
| 4 | `LoginOverlay` | [LoginOverlay.tsx:179](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/auth/LoginOverlay.tsx#L179) | `document.body` | Full-screen login modal (position:fixed) | ❌ Not used inside graph runtime |

**Total: 4 portal sites. All target `document.body`. All will escape the preview box.**

### B.2 — position:fixed Overlays (Complete List)

| # | Component | File:Line | Position | How It Computes Position |
|---|-----------|-----------|----------|-------------------------|
| 1 | `TOOLTIP_PORTAL_ROOT_STYLE` | [TooltipProvider.tsx:63](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/ui/tooltip/TooltipProvider.tsx#L63) | `position:fixed`, `inset:0` | Tooltip bubble: `window.innerWidth/innerHeight` via `computeTooltipPosition()` (:113) |
| 2 | `TOOLTIP_BUBBLE_STYLE_BASE` | [TooltipProvider.tsx:70](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/ui/tooltip/TooltipProvider.tsx#L70) | `position:fixed` | Left/top computed from anchorRect + viewport margins |
| 3 | `PopupOverlayContainer` | [PopupOverlayContainer.tsx:17](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/PopupOverlayContainer.tsx#L17) | `position:fixed`, full viewport | Container only; children positioned inside |
| 4 | `BACKDROP_STYLE` (NodePopup) | [NodePopup.tsx:13](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L13) | `position:fixed`, full viewport | Click-outside backdrop |
| 5 | `CHATBAR_STYLE` (MiniChatbar) | [MiniChatbar.tsx:33](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/MiniChatbar.tsx#L33) | `position:fixed` | `computeChatbarPosition()` uses `window.innerWidth/innerHeight` (:116-206) |
| 6 | `BASE_STYLE` (ChatShortageNotif) | [ChatShortageNotif.tsx:23](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/ChatShortageNotif.tsx#L23) | `position:fixed` | `updatePosition()` uses `window.innerWidth/innerHeight` (:88-94) |
| 7 | `AIActivityGlyph` | [AIActivityGlyph.tsx:13](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/AIActivityGlyph.tsx#L13) | `position:fixed` | Hardcoded `bottom:26px`, `left` uses `calc(50vw + 160px)` |
| 8 | `DEBUG_OVERLAY_STYLE` | [graphPlaygroundStyles.ts:43](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/graphPlaygroundStyles.ts#L43) | `position:fixed` | Hardcoded `top:16px`, `left:16px` |
| 9 | Dots menu | [CanvasOverlays.tsx:447](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L447) | `position:fixed` | `computeAnchoredMenuPosition()` uses `window.innerWidth/innerHeight` (:114-140) |
| 10 | LoginOverlay backdrop | [LoginOverlay.tsx:183](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/auth/LoginOverlay.tsx#L183) | `position:fixed`, `inset:0` | Full viewport |

---

## C. Exhaustive Global Listeners / Side Effects

### C.1 — Graph Runtime Listeners (Inside Shell / Render Loop)

| # | Listener | File:Line | Attached To | Cleanup? | Multi-Instance Safe? | Steals Input? |
|---|----------|-----------|-------------|----------|---------------------|---------------|
| 1 | `blur` | [Shell.tsx:518](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L518) | `window` | ✅ useEffect return | ✅ Both release drag independently | No |
| 2 | **`keydown` (capture)** | [Shell.tsx:547](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L547) | `window` | ✅ useEffect return | 🔴 **NO** — both instances call `e.preventDefault()` on Space/Arrow | **Partially** — checks `isInput` (INPUT/TEXTAREA/contentEditable), skips if user is typing ✅, but still blocks Space/Arrow globally when focus is on canvas |
| 3 | `blur` | [renderLoop.ts:581](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L581) | `window` | ✅ cleanup return | ✅ Benign (clears hover) | No |
| 4 | `wheel` | [renderLoop.ts:631](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L631) | `canvas` element | ✅ cleanup return | ✅ Scoped to own canvas | No |
| 5 | `loadingdone` | [renderLoop.ts:641](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L641) | `document.fonts` | ❌ **NOT cleaned up** | ⚠️ Benign (just clears text cache) | No |
| 6 | `graph-render-tick` dispatch | [renderLoop.ts:567](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L567) | `window` | N/A (dispatch) | 🔴 **NO** — both instances dispatch, and all listeners receive BOTH | No |

### C.2 — Graph Sub-component Listeners

| # | Listener | File:Line | Attached To | Cleanup? | Multi-Instance Safe? | Notes |
|---|----------|-----------|-------------|----------|---------------------|-------|
| 7 | `resize` (CanvasOverlays isNarrow) | [CanvasOverlays.tsx:204](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L204) | `window` | ✅ | ✅ Per-component state | Uses `window.innerWidth` |
| 8 | `resize` (CanvasOverlays dots menu) | [CanvasOverlays.tsx:218](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L218) | `window` | ✅ | ✅ | Uses `window.innerWidth/innerHeight` |
| 9 | `scroll` (CanvasOverlays dots menu) | [CanvasOverlays.tsx:219](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L219) | `window` | ✅ | ✅ | |
| 10 | `pointerdown` (CanvasOverlays close) | [CanvasOverlays.tsx:243](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L243) | `window` | ✅ | ✅ | Closes dots menu on outside click |
| 11 | `keydown` (CanvasOverlays Escape) | [CanvasOverlays.tsx:244](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L244) | `window` | ✅ | ✅ | Only when dotsMenuOpen |
| 12 | `keydown` (NodePopup Escape) | [NodePopup.tsx:171](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L171) | `window` | ✅ | ⚠️ Both would close popup on Escape | |
| 13 | `graph-render-tick` (NodePopup) | [NodePopup.tsx:376](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L376) | `window` | ✅ | 🔴 **NO** — receives tick from ALL instances | |
| 14 | `graph-render-tick` (MiniChatbar) | [MiniChatbar.tsx:346](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/MiniChatbar.tsx#L346) | `window` | ✅ | 🔴 **NO** — same issue | |
| 15 | `resize` (MiniChatbar) | [MiniChatbar.tsx:240](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/MiniChatbar.tsx#L240) | `window` | ✅ | ✅ | |
| 16 | `graph-render-tick` (ChatShortageNotif) | [ChatShortageNotif.tsx:111](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/ChatShortageNotif.tsx#L111) | `window` | ✅ | 🔴 **NO** | |
| 17 | `resize` (TooltipProvider) | [TooltipProvider.tsx:315](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/ui/tooltip/TooltipProvider.tsx#L315) | `window` | ✅ | ✅ | Only when tooltip is open |
| 18 | `scroll` (TooltipProvider) | [TooltipProvider.tsx:316](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/ui/tooltip/TooltipProvider.tsx#L316) | `window` | ✅ | ✅ | |

### C.3 — Side Effects

| Side Effect | File:Line | Multi-Instance Safe? |
|-------------|-----------|---------------------|
| `document.body.style.overflow = 'hidden'` | [LoginOverlay.tsx:56](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/auth/LoginOverlay.tsx#L56) | ⚠️ Not in graph runtime, but if someone triggers login overlay while preview is up... |
| Style tag injection (`ai-activity-glyph-styles`) | [AIActivityGlyph.tsx:37-47](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/AIActivityGlyph.tsx#L37-L47) | ✅ Idempotent (checks by ID before inserting) |
| `document.fonts.ready.then(...)` | [renderLoop.ts:639-641](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L639-L641) | ⚠️ Listener not cleaned up, but benign |

---

## D. Multi-Instance Collision Audit

### D.1 — Module-Level Singletons

| # | Variable | File:Line | Type | Collision Risk |
|---|----------|-----------|------|----------------|
| 1 | **`currentTopology`** | [topologyControl.ts:39](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/graph/topologyControl.ts#L39) | `let Topology` | 🔴 **CRITICAL** — both instances share the same topology state. Preview `setTopology()` overwrites main graph's topology. |
| 2 | **`topologyVersion`** | [topologyControl.ts:45](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/graph/topologyControl.ts#L45) | `let number` | 🔴 **CRITICAL** — incremented by both instances |
| 3 | **`globalSurfaceGeneration`** | [graphRenderingLoop.ts:83](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L83) | `let number` | ⚠️ MEDIUM — shared counter causing false hover invalidation across instances |
| 4 | `idleProbeLogged` | [canvasUtils.ts:5](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/canvasUtils.ts#L5) | `let boolean` | ✅ Minor — just prevents duplicate console log |
| 5 | `emitMutationEvent` | [topologyControl.ts:16](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/graph/topologyControl.ts#L16) | `let any` | ✅ Minor — dev-only mutation observer |
| 6 | `pendingMutationEvents` | [topologyControl.ts:17](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/graph/topologyControl.ts#L17) | `any[]` | ✅ Minor — dev-only queue |

### D.2 — Global Event Bus

| Event | Source | File:Line | Consumers | Collision Risk |
|-------|--------|-----------|-----------|----------------|
| **`graph-render-tick`** | `window.dispatchEvent(new CustomEvent(...))` | [renderLoop.ts:567](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L567) | NodePopup (:376), MiniChatbar (:346), ChatShortageNotif (:111) | 🔴 **CRITICAL** — both instances dispatch. NodePopup/MiniChatbar in instance A would receive ticks from instance B with wrong `transform` + `engineRef` data. Would cause popup positioning bugs. |

### D.3 — Classification

| Item | Classification | Rationale |
|------|---------------|-----------|
| `currentTopology` + `topologyVersion` | **Must be per-instance** | Preview topology must not overwrite main graph. |
| `globalSurfaceGeneration` | Can remain singleton **if preview unmounts before graph mounts** | The counter would reset semantics would be fine if only one instance runs at a time. |
| `graph-render-tick` event | **Must be per-instance (namespaced)** if both run simultaneously | Both dispatch to `window`, and consumers can't distinguish. |
| `idleProbeLogged` | Can remain singleton | Benign logging flag. |
| All providers (DocumentProvider, PopupProvider, FullChatProvider) | Already per-instance | Each Container creates its own providers. ✅ |
| PhysicsEngine | Already per-instance | Created via `new PhysicsEngine()` in Shell. ✅ |
| All useRef state (camera, hover, settings, renderScratch) | Already per-instance | Created inside `useGraphRendering` hook. ✅ |
| `gradientCache`, `textMetricsCache` | **Shared module-level Maps** (exported instances) | ⚠️ Both instances would write to and clear the same cache. Benign but could cause unnecessary cache thrashing. Can remain singleton if unmount is sequential. |

---

## E. Restore/Load Path for Sample JSON

### E.1 — How `pendingLoadInterface` Restores a Graph

Step-by-step at [Shell.tsx:800-960](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L800-L960):

1. **Guard checks** (:800-804): Skip if already consumed (`hasConsumedLoadRef`), restoring (`isRestoringRef`), no engine, or AI is active.
2. **Set flags** (:806-809): Mark consumed, restoring, read-path active.
3. **Call `onPendingLoadInterfaceConsumed()`** (:812): Signal parent to clear the prop.
4. **Validate topology** (:816-818): Must have `topology.nodes[]` and `topology.links[]` (arrays).
5. **Set document context** (:820-822): `documentContext.setDocument(rec.parsedDocument)`, `setInferredTitle(rec.title)`.
6. **Set topology** (:825): `setTopology(rec.topology, engine.config, { source: 'setTopology', docId: rec.docId })` — **this writes to the SINGLETON `currentTopology`**.
7. **Derive springs** (:827-830): From topology + config.
8. **Build physics nodes** (:856-917): For each topology node, use saved layout if present, else circular fallback.
9. **Restore camera** (:920+): If `rec.camera` has valid `panX/panY/zoom`, call `applyCameraSnapshot()`.
10. **End flag** (:958): Clear `isRestoringRef`.

### E.2 — Mandatory vs Optional Fields

Validated by `isSavedInterfaceRecordV1` at [savedInterfacesStore.ts:117-146](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/store/savedInterfacesStore.ts#L117-L146):

| Field | Required? | Checked How |
|-------|-----------|-------------|
| `id` | ✅ | `typeof string` |
| `createdAt` | ✅ | `Number.isFinite()` |
| `updatedAt` | ✅ | `Number.isFinite()` |
| `title` | ✅ | `typeof string` |
| `docId` | ✅ | `typeof string` |
| `source` | ✅ | Must be `'paste'`, `'file'`, or `'unknown'` |
| `dedupeKey` | ✅ | `typeof string` |
| `parsedDocument` | ✅ | Object with `.text` (string), `.warnings` (array), `.meta` (object) |
| `topology` | ✅ | Object with `.nodes` (array), `.links` (array) |
| `preview` | ✅ | Object with `.nodeCount`, `.linkCount`, `.charCount`, `.wordCount` (all `Number.isFinite()`) |
| `fileName` | Optional | Not checked |
| `mimeType` | Optional | Not checked |
| `analysisMeta` | Optional | If present, must be `{ version: 1, nodesById: { [id]: { sourceTitle?: string, sourceSummary?: string } } }` |
| `layout` | Optional | If present, must be `{ nodeWorld: { [id]: { x: number, y: number } } }` |
| `camera` | Optional | If present, must be `{ panX: number, panY: number, zoom: number }` |

### E.3 — Where `parseSavedInterfaceRecord` Is Called Today

| Caller | File:Line | Purpose |
|--------|-----------|---------|
| `useSavedInterfacesSync` | [useSavedInterfacesSync.ts:126](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts#L126) | Validate upsert payloads from BroadcastChannel |
| `useSavedInterfacesSync` | [useSavedInterfacesSync.ts:485](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts#L485) | Hydrate from localStorage on load |

### E.4 — How to Feed Dev-Provided JSON

**Recommended approach:**

1. Author a `src/assets/sampleGraphInterface.json` file matching `SavedInterfaceRecordV1` shape exactly.
2. Import it: `import sampleData from '../assets/sampleGraphInterface.json'`.
3. Validate at module load time: `const validatedSample = parseSavedInterfaceRecord(sampleData)`.
4. Pass as prop: `<GraphPhysicsPlaygroundContainer pendingLoadInterface={validatedSample} ... />`.
5. **Bundle size:** JSON can be used with code-splitting (`import()`) if large, but for a sample graph (~50 nodes) it will be <20KB — negligible.

**Import should live in** `SampleGraphPreview.tsx` (new wrapper component) or `PromptCard.tsx`.

### E.5 — Verification That Sample JSON Works

The `pendingLoadInterface` consumer at Shell:800 does exactly one thing: check `hasConsumedLoadRef.current`. On first mount, this is `false`. So:
- Mount preview with `pendingLoadInterface={sampleData}` → Shell consumes it on first `useEffect` tick.
- Call `onPendingLoadInterfaceConsumed` to clear the prop in parent.
- Graph restores and renders.

**Caveat:** If the preview component re-mounts (e.g. hot reload), `hasConsumedLoadRef` resets to `false` and it re-consumes. This is fine for a preview.

---

## F. Embedding + Resize Readiness

### F.1 — Places That Assume 100vh / Fullscreen

| File | Line | Value | Inside Graph Runtime? |
|------|------|-------|----------------------|
| `GraphScreenShell.tsx` | [L17](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/GraphScreenShell.tsx#L17) | `height: '100vh'` | ❌ It's the outer shell AROUND the graph, not the graph itself |
| `LoadingScreen.tsx` | [L9](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/LoadingScreen.tsx#L9) | `minHeight: '100vh'` | ⚠️ Shown by Shell (:1315) when `isGraphLoading=true` |
| `EnterPrompt.tsx` | [L176](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/EnterPrompt.tsx#L176) | `minHeight: '100vh'` | ❌ Not graph runtime |
| `CanvasOverlays.tsx` | [L514](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L514) | `maxHeight: 'calc(100vh - 40px)'` | ⚠️ Debug HUD overlay height — only visible when `debugOpen` |
| **`graphPlaygroundStyles.ts`** | [L14-21](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/graphPlaygroundStyles.ts#L14-L21) | `width: '100%', height: '100%'` | ✅ **Container-relative** — adapts to parent |
| Canvas element | [Shell.tsx:1341](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1341) | `width: '100%', height: '100%'` | ✅ **Container-relative** |
| NodePopup | [NodePopup.tsx:26-28](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L26-L28) | `width: '20vw'`, `height: '80vh'` | ⚠️ Uses viewport units — inappropriate for small preview |

**Conclusion:** The graph runtime itself (`CONTAINER_STYLE`, `MAIN_STYLE`, canvas) is fully container-relative. Only the `LoadingScreen` and overlays (CanvasOverlays debug HUD, NodePopup) use viewport units.

### F.2 — Overlay Positioning That Breaks on Container Resize

| Overlay | Breaks? | Why |
|---------|---------|-----|
| Dots menu (`computeAnchoredMenuPosition`) | ⚠️ Yes | Uses `window.innerWidth/innerHeight` — menu would fly outside small preview |
| Tooltip (`computeTooltipPosition`) | ⚠️ Yes | Uses `window.innerWidth/innerHeight` for viewport clamping |
| NodePopup (`computePopupPosition`) | ⚠️ Yes | Uses `window.innerWidth/innerHeight` for viewport clamping |
| MiniChatbar (`computeChatbarPosition`) | ⚠️ Yes | Same |
| ChatShortageNotif (`updatePosition`) | ⚠️ Yes | Same |
| AIActivityGlyph | ⚠️ Yes | Hardcoded `bottom: 26px`, `left: calc(50vw + 160px)` |

### F.3 — Camera/Zoom Heuristics

| Heuristic | File:Line | Assumes Fullscreen? |
|-----------|-----------|---------------------|
| `updateCameraContainment` | [renderLoop.ts:392](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L392) | ❌ Uses `width`/`height` from `getBoundingClientRect()` |
| Engine `updateBounds` | [renderLoopSurface.ts:51](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/renderLoopSurface.ts#L51) | ❌ Uses `rect.width`/`rect.height` |
| `ensureSeededGraph` initial spread | [renderLoop.ts:67-78](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L67-L78) | ❌ Uses `config.targetSpacing`/`config.initScale` |

**Camera system is fully container-scoped.** ✅

---

## G. Perf + Focus Concerns

### G.1 — rAF Loop Behavior

The render loop (`startGraphRenderLoop`) runs via `requestAnimationFrame` at up to 60fps. Per frame it does:

1. Physics scheduler: 1-N physics steps (~1-4ms)
2. Surface sync: DPR + canvas buffer size check (~0.1ms)
3. Canvas 2D draw: background → links → nodes → labels → overlays (~2-6ms)
4. Hover hit test: up to 10Hz heartbeat (~0.5ms)
5. `graph-render-tick` dispatch: CustomEvent to window (~0ms)

**Total per-frame budget consumption: ~3-10ms out of 16ms budget.**

Running two instances doubles this to ~6-20ms, leaving marginal headroom for the browser's own work (paint, layout, GC).

### G.2 — Keyboard Input Interference

The Shell keydown interceptor at [Shell.tsx:525-548](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L525-L548) runs in capture phase on `window`:

```typescript
const handleGlobalKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
    if (isInput) return;  // ← SAFE: won't block typing in EnterPrompt textarea
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
};
```

**Verdict:** The `isInput` guard correctly prevents interference with the EnterPrompt textarea. When user types in the textarea, Space/Arrow keys pass through normally. ✅

**However:** With TWO graph instances, both register this interceptor. If the user clicks the preview graph (giving it "focus"), then tabs to the textarea, the interceptor from Instance 2 (preview) would still be registered. It would NOT block typing (because of `isInput` check), but it IS consuming event listener resources. Minor concern.

### G.3 — UI Thread Contention

While user types on EnterPrompt:
- Preview graph's rAF loop runs continuously (~3-10ms per 16ms frame)
- Textarea input events are synchronous DOM events, unrelated to canvas
- React state updates from typing schedule reconciliation, which competes for the same 16ms budget
- **Risk:** On low-end devices, preview rAF + React reconciliation could cause dropped frames during fast typing
- **Mitigation:** Pause preview physics once graph is settled (physics energy → 0), or reduce to lower frame rate

---

## H. Blockers to 1:1 Embed (Ranked by Severity)

### 🔴 Critical (Must Fix Before Embed)

| # | Blocker | Severity | Seam Required |
|---|---------|----------|---------------|
| 1 | **`topologyControl` singleton** | 🔴 Critical | Preview's `setTopology()` overwrites main graph's topology. Must either: (A) make topology per-instance (pass as dependency), or (B) guarantee preview always unmounts before graph mounts (sequential lifecycle). |
| 2 | **`graph-render-tick` event bus** | 🔴 Critical | Both instances dispatch the event. Consumers (NodePopup, MiniChatbar, ChatShortageNotif) receive ticks from wrong instance with wrong `transform`/`engineRef`, causing mispositioned popups. Must either: (A) namespace the event per instance, or (B) disable popup/chatbar in preview mode. |

### ⚠️ Medium (Can Work Around)

| # | Blocker | Severity | Seam Required |
|---|---------|----------|---------------|
| 3 | **Portal containment** (4 sites) | ⚠️ Medium | All portals render to `document.body`, escaping preview box. Must either: (A) add `previewMode` prop to suppress popups/tooltips/AIGlyph, or (B) scope portals to container root. |
| 4 | **Overlay viewport positioning** (6 sites) | ⚠️ Medium | Overlays use `window.innerWidth/innerHeight`, appearing at viewport edges instead of preview edges. Acceptable if overlays are suppressed in preview mode. |
| 5 | **`globalSurfaceGeneration`** | ⚠️ Medium | Shared counter causes false hover invalidation. Acceptable if sequential lifecycle; needs per-instance scope if simultaneous. |
| 6 | **LoadingScreen 100vh** | ⚠️ Medium | If preview enters loading state (AI activity), the LoadingScreen renders at `minHeight: 100vh` which would overflow the preview container. Prevent by not triggering analysis in preview mode. |

### ✅ Low / No Action Needed

| # | Item | Severity | Reason |
|---|------|----------|--------|
| 7 | Canvas sizing | ✅ None | Already container-relative via `getBoundingClientRect()` + `ResizeObserver` |
| 8 | Camera system | ✅ None | Fully scoped to container dimensions |
| 9 | Physics engine | ✅ None | Created per-instance via `new PhysicsEngine()` |
| 10 | All providers | ✅ None | Created per Container instance |
| 11 | useGraphRendering state | ✅ None | All via `useRef` (per-instance) |
| 12 | Shell keydown vs typing | ✅ None | `isInput` guard correctly skips INPUT/TEXTAREA |
| 13 | `gradientCache` / `textMetricsCache` | ✅ Low | Shared Maps but benign — worst case is redundant cache clears |
| 14 | `document.fonts` listener leak | ✅ Low | Benign, just clears text cache on font load |

### Recommended Seam Summary

| Seam | Where | Effort |
|------|-------|--------|
| **A. `previewMode` prop** | Add to `GraphPhysicsPlaygroundProps` | Low — suppress AIActivityGlyph, PopupPortal, FullChatToggle, HalfLeftWindow, LoadingScreen, CanvasOverlays debug controls |
| **B. `topologyControl` per-instance or sequential** | Either refactor singleton, or ensure PromptCard unmounts preview before navigating to graph screen | Medium for refactor, Low for sequential |
| **C. `graph-render-tick` namespacing** | Add instance ID to CustomEvent, filter in consumers | Low-Medium |
| **D. Portal root override** | Accept optional `portalRoot` in TooltipProvider, PopupOverlayContainer | Medium (but unnecessary if popups suppressed by previewMode) |
| **E. `globalSurfaceGeneration` per-instance** | Move to ref or pass through deps | Low |

### Simplest Path (If Sequential Lifecycle)

If we guarantee that preview always unmounts before graph screen mounts (which is naturally true since `EnterPrompt` → graph is a screen transition that unmounts `EnterPrompt`):

1. Add `previewMode` prop → suppress popups, AI glyph, loading screen, tooltips, doc viewer, debug sidebar
2. Feed sample JSON via `pendingLoadInterface`
3. No topology refactor needed (only one instance alive at a time)
4. No event bus refactor needed (only one dispatcher at a time)
5. Set container to `overflow: hidden` + `borderRadius: 12px`

**This is the 0-drift, minimal-seam path.**
