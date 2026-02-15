# Report: EnterPrompt Sample Graph Preview Scandissect (2026-02-15)

## Scope
Scandissect only. No implementation changes.

## A. Current Preview Box Ownership (files + component tree)

### Current owner chain
1. `src/screens/AppShell.tsx:328` calls `renderScreenContent(...)`.
2. `src/screens/appshell/render/renderScreenContent.tsx:123` renders `EnterPrompt` when `screen === 'prompt'`.
3. `src/screens/EnterPrompt.tsx:123` renders `PromptCard`.
4. `src/components/PromptCard.tsx:84` renders the current sample graph preview placeholder box.

### Current preview box facts
- Placeholder label render: `src/components/PromptCard.tsx:85`.
- Placeholder style block: `src/components/PromptCard.tsx:267` (`height: 200px`, rounded border).
- There is no graph runtime mounted in this box today; it is static UI.

### Related prompt screen wrappers
- EnterPrompt root uses viewport height: `src/screens/EnterPrompt.tsx:176` (`minHeight: '100vh'`).
- Prompt card container also uses viewport height: `src/components/PromptCard.tsx:242` (`minHeight: '100vh'`).

## B. Graph Runtime Entrypoint + Recommended Mount Seam

### True graph screen chain (confirmed)
1. `AppShell` lazy-loads graph component from `src/playground/GraphPhysicsPlayground.tsx`: `src/screens/AppShell.tsx:53`.
2. Graph surface is passed as `GraphWithPending`: `src/screens/AppShell.tsx:121`.
3. Graph screen render path:
   - `src/screens/appshell/render/renderScreenContent.tsx:63`
   - `GraphScreenShell` wrapper: `src/screens/appshell/render/renderScreenContent.tsx:66`
   - `GraphWithPending` mount: `src/screens/appshell/render/renderScreenContent.tsx:67`
4. `GraphWithPending` is `GraphPhysicsPlayground` (thin wrapper): `src/playground/GraphPhysicsPlayground.tsx:5`.
5. That forwards directly to `GraphPhysicsPlaygroundContainer`: `src/playground/GraphPhysicsPlayground.tsx:2`.
6. Runtime providers + internal runtime are in `src/playground/GraphPhysicsPlaygroundShell.tsx:1491`.

### Minimal runtime surface to reuse (1:1)
- Canonical reusable component seam: `GraphPhysicsPlayground` from `src/playground/GraphPhysicsPlayground.tsx:5`.
- Practical runtime mount seam (includes required providers): `GraphPhysicsPlaygroundContainer` in `src/playground/GraphPhysicsPlaygroundShell.tsx:1491`.

### Existing runtime props (must stay shared)
Defined in `src/playground/GraphPhysicsPlaygroundShell.tsx:52`:
- `pendingAnalysisPayload`
- `onPendingAnalysisConsumed`
- `onLoadingStateChange?`
- `documentViewerToggleToken?`
- `pendingLoadInterface?`
- `onPendingLoadInterfaceConsumed?`
- `onRestoreReadPathChange?`
- `onSavedInterfaceUpsert?`
- `onSavedInterfaceLayoutPatch?`
- `enableDebugSidebar?`

Current graph screen uses same path and explicitly sets `enableDebugSidebar={false}` at `src/screens/appshell/render/renderScreenContent.tsx:68`.

## C. Sizing/Resize Mechanics + What Must Change

### How sizing is derived today
- Render loop reads live canvas rect every frame: `src/playground/rendering/graphRenderingLoop.ts:333`.
- If rect is `<= 0` on any axis, frame exits early (freeze behavior): `src/playground/rendering/graphRenderingLoop.ts:334`.
- Canvas backing size update is container-rect based, not window-size based: `src/playground/rendering/renderLoopSurface.ts:8`.
- `updateCanvasSurface` applies DPR hysteresis and resizes to `rect * dpr`: `src/playground/rendering/renderLoopSurface.ts:25-31`, `src/playground/rendering/renderLoopSurface.ts:43-51`.

### Surface snapshot and 0x0 handling
- Snapshot ref created in `useGraphRendering`: `src/playground/useGraphRendering.ts:92`.
- On invalid DPR, fallback to snapshot DPR: `src/playground/rendering/renderLoopSurface.ts:17-19`.
- On `rect.width <= 0 || rect.height <= 0`, no canvas resize occurs and prior surface is kept: `src/playground/rendering/renderLoopSurface.ts:36-40` plus early return in loop (`graphRenderingLoop.ts:334-336`).

### Container-relative vs viewport assumptions
Container-relative core:
- `CONTAINER_STYLE` is `width:100%, height:100%`: `src/playground/graphPlaygroundStyles.ts:14-18`.
- Canvas style is `width:100%, height:100%`: `src/playground/GraphPhysicsPlaygroundShell.tsx:1346`.

Viewport/global assumptions that conflict with preview box mounting:
- `GraphScreenShell` forces full viewport (`height:100vh`): `src/screens/appshell/render/GraphScreenShell.tsx:17`.
- Loading fallback forces full viewport (`minHeight:100vh`): `src/screens/LoadingScreen.tsx:8`.
- Several overlays use `position: fixed` and window dimensions/listeners (details in section E).

### Resize readiness conclusion
- The core canvas loop is already container-rect-driven and should respond to live container resize without window resize hooks.
- But runtime includes many viewport-level overlays/listeners that are not container-scoped; these are the blocking seams for a small embedded preview.

## D. Payload Contract + Custom JSON Load Path

### Canonical payload contract (must reuse, no parallel format)
`SavedInterfaceRecordV1` in `src/store/savedInterfacesStore.ts:20` includes:
- Identity/meta: `id`, `createdAt`, `updatedAt`, `title`, `docId`, `source`, `dedupeKey`.
- Document: `parsedDocument` (`ParsedDocument` fields in `src/document/types.ts:6`).
- Graph: `topology` (`Topology` fields in `src/graph/topologyTypes.ts:46`).
- Optional enrichments: `analysisMeta`, `layout`, `camera`.
- Sidebar stats: `preview` counts.

Validation gate:
- `parseSavedInterfaceRecord(...)` in `src/store/savedInterfacesStore.ts:167`.
- Structural checks in `isSavedInterfaceRecordV1(...)`: `src/store/savedInterfacesStore.ts:117`.

### What restore path actually consumes
Restore logic in `src/playground/GraphPhysicsPlaygroundShell.tsx:799` uses:
- `rec.topology.nodes/links` as hard requirement (`invalid_topology` guard): `src/playground/GraphPhysicsPlaygroundShell.tsx:816`.
- `rec.parsedDocument` and `rec.title`: `src/playground/GraphPhysicsPlaygroundShell.tsx:820-821`.
- Optional `rec.analysisMeta.nodesById`: `src/playground/GraphPhysicsPlaygroundShell.tsx:838-840`.
- Optional `rec.layout.nodeWorld` and `rec.camera`: `src/playground/GraphPhysicsPlaygroundShell.tsx:844-850`, applied at `src/playground/GraphPhysicsPlaygroundShell.tsx:925-930`.

### Can static JSON import feed same restore path?
Yes, if the imported JSON is `SavedInterfaceRecordV1`-compatible and passed through `parseSavedInterfaceRecord(...)` first.

Recommended adaptation seam (if needed):
- If dev JSON is only `payloadJson` body or partial record, wrap into full `SavedInterfaceRecordV1` (id/timestamps/preview/dedupeKey) before calling restore path.
- Do not create a preview-only payload type.

Evidence for same parser used on remote payloads:
- `useSavedInterfacesSync` parses remote `payloadJson` with `parseSavedInterfaceRecord`: `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts:485`.

## E. Portal/Overlay Containment Risks + Seams

### Body-level portal escapes (critical)
1. Popup system root uses portal to `document.body`:
   - `src/popup/PopupOverlayContainer.tsx:31-35`.
   - Anything in this system will escape preview box bounds.
2. AI activity glyph uses portal to `document.body` and fixed viewport coordinates:
   - `src/playground/components/AIActivityGlyph.tsx:59-70`.
3. Tooltip layer is app-wide body portal:
   - `src/ui/tooltip/TooltipProvider.tsx:18-21`.

### Fixed-position viewport overlays inside runtime
1. Node popup backdrop and card:
   - Backdrop fixed full screen: `src/popup/NodePopup.tsx:13-20`.
   - Position sync from global `graph-render-tick`: `src/popup/NodePopup.tsx:376-378`.
2. Mini chatbar fixed viewport panel:
   - `src/popup/MiniChatbar.tsx:33`.
   - Listens to global `graph-render-tick`: `src/popup/MiniChatbar.tsx:346-347`.
3. Chat shortage notif fixed viewport:
   - `src/popup/ChatShortageNotif.tsx:23`.
   - Uses `window.innerWidth/innerHeight`: `src/popup/ChatShortageNotif.tsx:86`, `src/popup/ChatShortageNotif.tsx:91`.
4. FullChat toggle fixed viewport:
   - `src/fullchat/FullChatToggle.tsx:13-16`.
5. Canvas overlays include fixed menu:
   - Dots menu fixed: `src/playground/components/CanvasOverlays.tsx:447`.

### Global event bus and listener coupling
- Graph runtime broadcasts unscoped global event on `window`: `src/playground/rendering/graphRenderingLoop.ts:567`.
- Popup/chat overlays consume the same global event name.
- In multi-instance preview + graph scenarios, this can cross-trigger updates across instances.

### Containment seam needed
- Runtime needs a container-scoped overlay host and instance-scoped tick channel.
- Current code has no prop for portal root override or per-instance event namespace.

## F. Perf and Multi-Instance Risks

### Typing perf risk on EnterPrompt
- Mounting full runtime during prompt means physics/render loop runs continuously while user types.
- Render loop is persistent `requestAnimationFrame` in `startGraphRenderLoop`: `src/playground/rendering/graphRenderingLoop.ts:633`.
- Additional prompt-side UI work and graph loop can compete for frame budget.

### Two-instance risk (preview + main graph overlap)
1. Each instance creates its own `PhysicsEngine` (`GraphPhysicsPlaygroundShell.tsx:136-139`) and own rAF loop.
2. Topology control is module-global singleton (`src/graph/topologyControl.ts:39`), so instances share mutation state.
3. Global `graph-render-tick` event is shared across all instances (`graphRenderingLoop.ts:567`).
4. Multiple global listeners are attached per instance (`window` keydown/blur etc):
   - `src/playground/GraphPhysicsPlaygroundShell.tsx:518`, `src/playground/GraphPhysicsPlaygroundShell.tsx:547`.

### Additional cleanup risk relevant for preview mount/unmount churn
- `graphRenderingLoop` cleanup does not remove canvas wheel listener or `document.fonts` listener.
  - Add: `canvas.addEventListener('wheel', ...)` at `src/playground/rendering/graphRenderingLoop.ts:631`.
  - Cleanup currently only removes blur and cancels rAF: `src/playground/rendering/graphRenderingLoop.ts:644-648`.
- This can leak listeners if preview mounts/unmounts repeatedly.

### Cleanest lifecycle approach (analysis only)
- Avoid simultaneous preview and main graph runtime if possible.
- Unmount preview before graph screen mounts (or on transition start) to avoid duplicate runtime loops and global event collisions.

## G. Recommended Implementation Plan (steps only, no code)

1. Introduce a shared graph runtime mount component that reuses `GraphPhysicsPlayground` directly and accepts a mode/config for prompt preview.
2. Add explicit preview lifecycle ownership in EnterPrompt so preview unmounts before transition to `graph`.
3. Feed preview data through canonical `SavedInterfaceRecordV1` parsing (`parseSavedInterfaceRecord`) and then into existing `pendingLoadInterface` restore path.
4. Add a container-scoped overlay root seam for popup/chat/glyph surfaces (replace hard `document.body` portals and fixed viewport assumptions where needed).
5. Add per-instance tick channel scoping (or route overlays by instance id) to avoid cross-instance `graph-render-tick` interference.
6. Patch runtime cleanup gaps in render loop (wheel/font listeners) to make preview mount/unmount safe.
7. Verify container resizing behavior in a small rounded preview box after seams above are in place.

## Search Notes (forensic)
- Preview placeholder search:
  - `rg -n "Sample Graph Preview|sample graph|preview" src/screens src/components src/screens/appshell`
- Runtime chain search:
  - `rg -n "EnterPrompt|PromptCard|GraphScreenShell|GraphWithPending|GraphPhysicsPlaygroundShell|renderScreenContent" src`
- Sizing/portal/global listener search:
  - `rg -n "getBoundingClientRect|ResizeObserver|surface|0x0|createPortal|document.body|graph-render-tick|window.addEventListener" src/playground src/popup src/fullchat src/ui`

## Key File Index
- `src/components/PromptCard.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/screens/AppShell.tsx`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/appshell/render/GraphScreenShell.tsx`
- `src/playground/GraphPhysicsPlayground.tsx`
- `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `src/playground/useGraphRendering.ts`
- `src/playground/rendering/graphRenderingLoop.ts`
- `src/playground/rendering/renderLoopSurface.ts`
- `src/store/savedInterfacesStore.ts`
- `src/document/nodeBinding.ts`
- `src/graph/topologyControl.ts`
- `src/popup/PopupOverlayContainer.tsx`
- `src/popup/NodePopup.tsx`
- `src/popup/MiniChatbar.tsx`
- `src/popup/ChatShortageNotif.tsx`
- `src/playground/components/AIActivityGlyph.tsx`
- `src/fullchat/FullChatToggle.tsx`
- `src/ui/tooltip/TooltipProvider.tsx`
