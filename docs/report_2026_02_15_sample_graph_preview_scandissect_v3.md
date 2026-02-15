# Report: EnterPrompt Sample Graph Preview Scandissect V3 (2026-02-15)

## Header Constraints (from request)
1. Do NOT invent preview-only graph payload types.
2. Do NOT add behavior in this run; map only existing behavior and seams needed.
3. Findings must remain compatible with future realtime preview box resize.
4. If true 1:1 embed is impossible without refactor, call it out directly.

## Goal Context
Target state is EnterPrompt sample preview mounting the exact graph runtime path used by graph screen, with sample JSON entering canonical restore flow (`SavedInterfaceRecordV1` -> `parseSavedInterfaceRecord` -> `pendingLoadInterface` -> `GraphPhysicsPlaygroundShell` restore effect).

## Surgical Lens
For each item below, classify as:
- Global
- Escapes container
- Must become container-scoped
- Must become instance-scoped
- Risk if embedded

## A) Escape Hatch Inventory (100% complete)

### A1) All `createPortal` sites in repo (verified exhaustive)
Search evidence:
- `rg -n "createPortal" src`
- `rg -n "createPortal" -g "!node_modules/**" -g "!dist/**"`

Result: exactly 4 source sites.

1. `src/auth/LoginOverlay.tsx:179`
- Renders: auth blocking overlay/card.
- Trigger: `EnterPrompt` sets `loginOverlayOpen` when no user (`src/screens/EnterPrompt.tsx:39`, `src/screens/EnterPrompt.tsx:161-167`).
- Assumptions: portal target `document.body`; full viewport fixed backdrop (`src/auth/LoginOverlay.tsx:183`); body scroll lock via `document.body.style.overflow='hidden'` (`src/auth/LoginOverlay.tsx:53-58`).
- Classification: Global + escapes container.
- Risk if embedded: preview-in-box can trigger whole-screen auth overlay and lock page scroll.

2. `src/ui/tooltip/TooltipProvider.tsx:99-103`
- Renders: tooltip layer root + bubble.
- Trigger: any caller of `useTooltipController().showTooltip(...)`.
- Assumptions: portal target `document.body`; fixed layer (`src/ui/tooltip/TooltipProvider.tsx:43`, `src/ui/tooltip/TooltipProvider.tsx:50`); anchor rect from viewport `getBoundingClientRect()` (`src/ui/tooltip/TooltipProvider.tsx:130`).
- Classification: Global + escapes container.
- Risk if embedded: preview tooltip can render outside preview box unless target and coordinates are container-relative.

3. `src/popup/PopupOverlayContainer.tsx:31-35`
- Renders: popup overlay host used by `PopupPortal` (`src/popup/PopupPortal.tsx:30-38`) including `NodePopup` and `MiniChatbar`.
- Trigger: popup open or mini-chat open (`src/popup/PopupPortal.tsx:24-27`).
- Assumptions: portal target `document.body`; fixed full viewport host (`src/popup/PopupOverlayContainer.tsx:17-22`).
- Classification: Global + escapes container.
- Risk if embedded: graph popup systems will escape preview box and own viewport-level layering.

4. `src/playground/components/AIActivityGlyph.tsx:59-70`
- Renders: activity glyph dot.
- Trigger: `state.aiActivity` from `DocumentProvider` (`src/playground/components/AIActivityGlyph.tsx:31`, `src/playground/components/AIActivityGlyph.tsx:53-56`).
- Assumptions: portal target `document.body`; fixed position (`src/playground/components/AIActivityGlyph.tsx:13`) and viewport math (`left: calc(50vw + 160px)` when viewer open, `src/playground/components/AIActivityGlyph.tsx:15`).
- Classification: Global + escapes container.
- Risk if embedded: glyph position drifts relative to preview box and can overlap unrelated UI.

Conclusion: zero other portal sites in `src`.

### A2) All fixed/window-anchored overlays in graph runtime path

Graph runtime tree mounts here: `src/playground/GraphPhysicsPlaygroundShell.tsx:1319-1484`.

1. `PopupOverlayContainer` (`src/popup/PopupOverlayContainer.tsx:17`)
- Screen presence: graph runtime only.
- Uses viewport full-screen fixed host.
- Risk: escapes preview.

2. `NodePopup` backdrop + panel (`src/popup/NodePopup.tsx:13` + popup absolute inside fixed host)
- Position model: `window.innerWidth/innerHeight` (`src/popup/NodePopup.tsx:104-105`) + per-frame sync from global tick (`src/popup/NodePopup.tsx:376-378`).
- Risk: viewport-clamped, not preview-clamped.

3. `MiniChatbar` (`src/popup/MiniChatbar.tsx:33`)
- Position model: `window.innerWidth/innerHeight` (`src/popup/MiniChatbar.tsx:141-142`) and popup DOM rect (`src/popup/MiniChatbar.tsx:317`), sync by global tick (`src/popup/MiniChatbar.tsx:346-347`).
- Risk: viewport placement, not container placement.

4. `ChatShortageNotif` (`src/popup/ChatShortageNotif.tsx:23`)
- Position model: anchor rect + `window.innerWidth/innerHeight` clamps (`src/popup/ChatShortageNotif.tsx:84-94`) and global tick listener (`src/popup/ChatShortageNotif.tsx:111`).
- Risk: viewport clamps break in small box.

5. `AIActivityGlyph` (`src/playground/components/AIActivityGlyph.tsx:13`)
- Position model: fixed viewport offsets (`src/playground/components/AIActivityGlyph.tsx:13-16`).
- Risk: escapes and misaligns in embed.

6. `CanvasOverlays` dots menu (`src/playground/components/CanvasOverlays.tsx:447`)
- Position model: trigger rect + viewport clamps from `window.innerWidth/innerHeight` (`src/playground/components/CanvasOverlays.tsx:118-132`, `212`, `421`).
- Risk: menu may leave preview bounds.

7. `FullChatToggle` (`src/fullchat/FullChatToggle.tsx:13`)
- Position model: fixed bottom-right viewport and mobile threshold by `window.innerWidth` (`src/fullchat/FullChatToggle.tsx:48`, `52`).
- Risk: toggle appears at app viewport edge, not preview edge.

8. Debug fixed style token (`src/playground/graphPlaygroundStyles.ts:43`)
- Screen presence: debug surfaces.
- Risk: fixed by viewport if used.

### A3) Adjacent overlays that can still affect preview session
Even if not graph-owned, these can coexist while EnterPrompt preview is mounted:
- `LoginOverlay` fixed + portal + body lock (`src/auth/LoginOverlay.tsx:53-58`, `179`, `183`).
- `Sidebar` fixed menus (`src/components/Sidebar.tsx:1639`, `1681`, `1756`) with viewport math (`src/components/Sidebar.tsx:226-281`).
- `ModalLayer` fixed backdrops (`src/screens/appshell/overlays/ModalLayer.tsx:476`, `605`, `686`, `755`).
- `OnboardingChrome` fixed controls (`src/screens/appshell/overlays/OnboardingChrome.tsx:37`).
- Prompt drag/error fixed overlays (`src/screens/EnterPrompt.tsx:187`, `227`).

Risk if embedded: layered conflicts and unexpected input ownership while preview is interactive.

## B) Global Event/Listener Inventory (super exhaustive)

### B1) Graph runtime listeners and cleanup status

1. `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `ResizeObserver` create: `287`; disconnect cleanup: `290`.
- `window.blur` add/remove: `518-519`.
- `window.keydown` capture add/remove: `547-548`.
- Cleanup status: complete for these hooks.
- Embedded risk: global key capture still active while user is in prompt; it guards input targets (`529-537`) but remains global.

2. `src/playground/rendering/graphRenderingLoop.ts`
- RAF loop start/continuation: `633`, `575`; cancel: `647`.
- `window.blur` add/remove: `581`, `645`.
- `canvas.wheel` add only: `631` (no remove in teardown at `644-648`).
- `document.fonts.ready.then(handleFontLoad)` at `640`.
- `document.fonts.addEventListener('loadingdone', handleFontLoad)` at `641` (no remove in teardown).
- Cleanup status: incomplete for `canvas.wheel` and `document.fonts.loadingdone`.
- Embedded risk: mount/unmount churn can leak wheel/font handlers.

3. `src/playground/components/CanvasOverlays.tsx`
- `window.resize` add/remove: `204-205`.
- `window.resize` + `window.scroll` add/remove: `218-223`.
- `window.pointerdown` + `window.keydown` capture add/remove: `243-247`.
- Cleanup status: complete.

4. `src/popup/NodePopup.tsx`
- `window.keydown` add/remove: `171-172`.
- `transitionend` add/remove: `206`, `210`.
- `window.graph-render-tick` add/remove: `376-378`.
- Timers cleaned: `149-153`, `198` cleanup.
- Cleanup status: complete.

5. `src/popup/MiniChatbar.tsx`
- `window.resize` add/remove: `240-241`.
- `scroller.scroll` add/remove: `294`, `300`.
- `window.graph-render-tick` add/remove: `346-347`.
- Timers/RAF cleaned in effect cleanup: `301-303`.
- Cleanup status: complete.

6. `src/popup/ChatShortageNotif.tsx`
- `window.resize` add/remove: `109`, `117`.
- `window.scroll` capture add/remove: `110`, `118`.
- `window.graph-render-tick` add/remove: `111`, `119`.
- Cleanup status: complete.

7. `src/fullchat/FullChatToggle.tsx`
- `window.resize` add/remove: `53-54`.
- Cleanup status: complete.

8. `src/fullchat/FullChatbar.tsx`
- `document.visibilitychange` add/remove: `577-578`.
- `window.resize` add/remove: `608-610`.
- Multiple timers/RAF with cleanup refs.
- Cleanup status: complete for listed global listeners.

9. `src/hooks/useFullscreen.ts` (used by graph overlays)
- `document.fullscreenchange` add at `19`, no remove path (singleton lifetime).
- Cleanup status: intentionally persistent singleton listener.
- Embedded risk: globally shared fullscreen semantics.

10. Prompt/onboarding listeners affecting preview behavior
- Wheel guard: `window.wheel` capture add/remove in `src/screens/appshell/transitions/useOnboardingWheelGuard.ts:23-25`; handler always `preventDefault` while active (`13-19`).
- PromptCard outside click: `document.mousedown` add/remove (`src/components/PromptCard.tsx:51-53`).
- Embedded risk: wheel zoom on preview blocked during onboarding prompt.

### B2) Global CustomEvent channels

1. Producer
- `graph-render-tick` emitted every graph frame: `src/playground/rendering/graphRenderingLoop.ts:567-569`.

2. Consumers
- `NodePopup`: `src/popup/NodePopup.tsx:376-378`.
- `MiniChatbar`: `src/popup/MiniChatbar.tsx:346-347`.
- `ChatShortageNotif`: `src/popup/ChatShortageNotif.tsx:111-119`.

3. Other channels
- No other active `CustomEvent` channels found in `src`; one commented old name in `src/popup/NodePopup.tsx:275`.

### B3) Explicit cleanup gaps (confirmed)
1. Missing remove for `canvas.wheel` in `startGraphRenderLoop` teardown.
2. Missing remove for `document.fonts.loadingdone` in `startGraphRenderLoop` teardown.
3. `document.fonts.ready.then(...)` has no cancel path; low leak risk but still persistent callback.

## C) Singleton / Module-Global State Inventory (preview+graph overlap critical)

### C1) High-impact graph and render globals

1. `src/graph/topologyControl.ts`
- Globals: `currentTopology` (`39`), `topologyVersion` (`45`), `emitMutationEvent` (`16`), `pendingMutationEvents` (`17`).
- Collision potential: high, core topology shared process-wide.
- Classification: must become instance-scoped for concurrent preview + graph.
- Minimal seam: introduce topology store instance (context/factory), inject into graph runtime and topology APIs.

2. `src/playground/rendering/graphRenderingLoop.ts`
- Global: `globalSurfaceGeneration` (`83`).
- Collision potential: medium; cross-instance hover invalidation coupling.
- Classification: should be instance-scoped if overlap is allowed.
- Minimal seam: move counter into loop instance state/ref.

3. Render cache singletons
- `gradientCache` singleton (`src/playground/rendering/gradientCache.ts:76`).
- `textMetricsCache` singleton (`src/playground/rendering/textCache.ts:56`).
- Collision potential: medium (perf/cache churn), lower correctness risk.
- Classification: can remain global if strict no-overlap policy; otherwise instance-scoped cache objects.
- Minimal seam: pass cache objects via loop deps.

4. Fullscreen singleton
- `fullscreenControllerSingleton` (`src/hooks/useFullscreen.ts:3`).
- Collision potential: app-global fullscreen state by design.
- Classification: keep global only if preview uses same fullscreen behavior; otherwise inject per-surface controller.

### C2) App-wide stores/buses touched by graph-linked UI

1. `activeSavedInterfacesKey` global mutable
- `src/store/savedInterfacesStore.ts:6`.
- Collision potential: storage namespace mutable process-wide.
- Classification: acceptable app-global, but not per-instance.

2. Money/shortage/balance/topup globals
- `src/money/shortageStore.ts:16-24` (state + listeners).
- `src/store/balanceStore.ts:14-24` (state + listeners + inFlight).
- `src/money/moneyNotices.ts:21-22` (global notice list).
- `src/money/topupEvents.ts:1` (global listener set).
- Collision potential: UI cross-talk across instances.
- Classification: keep global if product semantics are app-wide; otherwise scoped stores needed.

3. Dev globals
- `window.__engine` set in dev: `src/playground/GraphPhysicsPlaygroundShell.tsx:141-142`.
- Collision potential: debug alias overwritten by latest mounted instance.

### C3) Instance-scope requirement matrix
1. Must be per-instance for true concurrent preview+main:
- Topology store (`topologyControl`).
- Tick channel namespace (section B2).
- Loop surface generation counter.

2. Can remain singleton only if lifecycle policy enforces no overlap:
- Render caches.
- Fullscreen controller.
- Money/balance/notice stores.

3. Unknown/risky (design decision needed):
- Saved interface storage key mutability under concurrent auth scope changes.

## D) Minimum Embed Contract (realistic)

### D1) Minimal React subtree for 1:1 runtime in PromptCard
Exact runtime component path:
- `GraphPhysicsPlayground` -> `GraphPhysicsPlaygroundContainer` -> `GraphPhysicsPlaygroundInternal`.
- Source: `src/playground/GraphPhysicsPlayground.tsx:5-6`, `src/playground/GraphPhysicsPlaygroundShell.tsx:1491-1520`.

Minimal mount subtree in PromptCard preview box:
1. Keep app-level providers already above EnterPrompt:
- `AuthProvider` at root (`src/main.tsx:17-19`).
- `TooltipProvider` wraps `AppShell` (`src/screens/AppShell.tsx:370`).
2. Mount `GraphWithPending` (or `GraphPhysicsPlayground`) directly inside preview container.
3. Supply same props contract as graph screen uses (`src/screens/appshell/render/renderScreenContent.tsx:67-82`).

### D2) GraphScreenShell viewport force and bypass
- `GraphScreenShell` enforces `height: 100vh` (`src/screens/appshell/render/GraphScreenShell.tsx:17`).
- Preview box embed should bypass `GraphScreenShell` and mount graph runtime directly into preview div to avoid fullscreen layout constraints.

### D3) Runtime-local non-optional wrappers
Already inside `GraphPhysicsPlaygroundContainer`:
- `DocumentProvider`, `PopupProvider`, `FullChatProvider` (`src/playground/GraphPhysicsPlaygroundShell.tsx:1503-1505`).

## E) Payload Contract + Adapter Spec (dev JSON sample)

### E1) Canonical contract
- `SavedInterfaceRecordV1` type: `src/store/savedInterfacesStore.ts:20-47`.
- Parser gate: `parseSavedInterfaceRecord` (`src/store/savedInterfacesStore.ts:167`).
- Parser requires metadata + parsedDocument object + topology arrays + preview counts (`src/store/savedInterfacesStore.ts:117-145`).

### E2) Existing sample JSON shape and mismatch
Sample files under `paper_sample_arnvoid/*.json` have top-level keys:
- `version, exportedAt, title, parsedDocument, topology, layout, camera, analysisMeta`.
- Evidence: file read + key listing.
- This matches `DevInterfaceExportV1` defined in runtime (`src/playground/GraphPhysicsPlaygroundShell.tsx:91-100`).

Missing vs `SavedInterfaceRecordV1`:
- `id`, `createdAt`, `updatedAt`, `docId`, `source`, `preview`, `dedupeKey`.
- Also `parsedDocument` is nullable in `DevInterfaceExportV1`, but required object in `SavedInterfaceRecordV1` parser.

### E3) Adapter spec: `wrapDevExportAsSavedInterfaceRecordV1(devExport)`

Required fields to produce:
1. `id`: deterministic or generated string.
2. `createdAt`, `updatedAt`: use `devExport.exportedAt` when finite; else `Date.now()`.
3. `title`: `devExport.title` fallback `'Untitled Interface'`.
4. `docId`: prefer `parsedDocument.id` if string; else generated from id.
5. `source`: `'unknown'`.
6. `parsedDocument`: if null, synthesize minimal valid object with `text`, `warnings`, `meta`.
7. `topology`: from export, must contain arrays.
8. `analysisMeta/layout/camera`: pass through when valid.
9. `preview`: `nodeCount = topology.nodes.length`, `linkCount = topology.links.length`, `charCount/wordCount` from parsedDocument meta if finite else computed from text.
10. `dedupeKey`: via `buildSavedInterfaceDedupeKey({ docId, title, topology })` (`src/store/savedInterfacesStore.ts` function exists below shown section).

Risk note:
- If adapter emits parser-invalid shape, canonical load path rejects record before restore.

### E4) Canonical loading path (only acceptable)
1. Parse candidate with `parseSavedInterfaceRecord(...)`.
2. Set parsed record as `pendingLoadInterface` in AppShell state (`src/screens/AppShell.tsx:78`, `selectSavedInterfaceById` flow at `236-245`).
3. Runtime restore effect in `GraphPhysicsPlaygroundShell` consumes it (`src/playground/GraphPhysicsPlaygroundShell.tsx:799-975`).

No alternate preview-only restore path should be introduced.

## F) Resize Readiness (beyond canvas rect)

### F1) What already resizes correctly
1. Container is parent-relative: `CONTAINER_STYLE` and `MAIN_STYLE` (`src/playground/graphPlaygroundStyles.ts:14-25`).
2. Canvas fills runtime area (`src/playground/GraphPhysicsPlaygroundShell.tsx:1341`).
3. Loop uses live `canvas.getBoundingClientRect()` every frame (`src/playground/rendering/graphRenderingLoop.ts:333`).
4. 0x0 guard skips work safely (`src/playground/rendering/graphRenderingLoop.ts:334-336`).
5. Surface snapshot logic updates display size and clears caches when changed (`src/playground/rendering/renderLoopSurface.ts:8-67`).

### F2) What still breaks under container resize/embed
1. Popup/chat/notif placement uses viewport dimensions (`NodePopup`, `MiniChatbar`, `ChatShortageNotif`).
2. Dots menu uses viewport clamps and fixed positioning (`CanvasOverlays`).
3. AI glyph uses viewport-dependent left offset.
4. FullChat toggle is fixed to viewport corner.
5. `CanvasOverlays` uses `maxHeight: calc(100vh - 40px)` (`src/playground/components/CanvasOverlays.tsx:514`).
6. Loading screen uses `minHeight: 100vh` (`src/screens/LoadingScreen.tsx:9`).

### F3) If portal root becomes container-scoped, what else must change
1. Convert overlay positioning math from viewport (`window.innerWidth/innerHeight`) to container rect basis.
2. Ensure fixed overlays become absolute within container root (or equivalent scoped positioning strategy).
3. Rebase tooltip and popup anchor coordinates to container space.
4. Remove/replace `100vh`-based limits in overlay menus for preview mode.

## G) Lifecycle + Perf Risk Matrix

### G1) Known runtime behavior today
1. Graph loop is continuous RAF while mounted (`src/playground/rendering/graphRenderingLoop.ts:633`, `575`).
2. Loop stops only on unmount (`src/playground/useGraphRendering.ts:178-183` -> cleanup calls stop function).
3. On window blur, runtime clears hover only; physics/render loop continues (`src/playground/rendering/graphRenderingLoop.ts:579-582`).
4. No graph-level `visibilitychange` pause hook.

### G2) Prompt typing overlap risk
1. EnterPrompt typing and graph loop run on same main thread.
2. Additional global tick dispatch every frame adds overhead.
3. Global keydown capture exists but skips editable targets (`src/playground/GraphPhysicsPlaygroundShell.tsx:529-537`).
4. Onboarding wheel guard currently blocks wheel interactions on prompt (`src/screens/appshell/transitions/useOnboardingWheelGuard.ts:13-19`).

### G3) Safe lifecycle rules (factual, based on current hooks)
1. Unmount preview before mounting main graph: supported now and safest with current singletons.
2. Delayed preview mount after prompt settle: possible via conditional render (no runtime changes required).
3. Pause on tab hidden: not available for graph loop today; requires new seam.
4. Pause loop without unmount: not available today; requires new seam.

## H) Verification Checklist for Future Implementation

Manual checks to prove 1:1 parity and safety:
1. Runtime parity: preview drag feel, hover dimming, click behavior, popup open/close match graph screen.
2. Input ownership: wheel over preview zooms graph only, no page scroll bleed.
3. Containment: popup/chat/tooltip/glyph remain inside preview box bounds.
4. Resize behavior: drag-resize preview box repeatedly; graph redraw and overlay positions remain stable.
5. Transition hygiene: prompt preview unmount/mount across prompt->graph transition shows no cross-talk.
6. Leak test: mount/unmount preview 20 times; verify no accumulated extra listeners (wheel/fonts/tick).
7. Dual-instance test (if overlap allowed): verify no topology/tick cross-coupling.
8. Restore path integrity: sample JSON load succeeds only through `parseSavedInterfaceRecord` + `pendingLoadInterface` and produces same restored behavior as sidebar-selected saved interface.

## Blunt Blockers to True 1:1 Embed (without refactor)
1. Body portal + viewport-fixed overlay architecture makes strict box-contained embed impossible without overlay scoping refactors.
2. Global tick bus (`graph-render-tick`) prevents clean concurrent instances without namespacing/instance channel seam.
3. Global topology singleton prevents true concurrent preview+main runtime correctness without per-instance topology state.
4. Listener cleanup gaps in render loop create mount/unmount leak risk for preview lifecycle churn.

## Search Notes
- `rg -n "createPortal" src`
- `rg -n "createPortal" -g "!node_modules/**" -g "!dist/**"`
- `rg -n "position:\s*'fixed'" src`
- `rg -n "window\.innerWidth|window\.innerHeight|window\.scrollX|window\.scrollY|getBoundingClientRect\(" src/...`
- `rg -n "window\.addEventListener|document\.addEventListener|canvas\.addEventListener|document\.fonts\.addEventListener|CustomEvent\(|dispatchEvent\(" src/...`
- `rg -n -F "addEventListener('graph-render-tick'" src`
- `rg -n -F "removeEventListener('graph-render-tick'" src`
