# Report: EnterPrompt Sample Graph Preview Scandissect V2 (2026-02-15)

## Scope
Scandissect only. No implementation changes.

## A. Full Dependency + Provider Map (Graph Runtime)

### A1) Exact runtime mount chain and file ownership
1. `AppShell` lazy-loads graph runtime module (`src/screens/AppShell.tsx:53-56`).
2. `renderScreenContent(graph)` mounts graph inside `GraphScreenShell` (`src/screens/appshell/render/renderScreenContent.tsx:63-83`).
3. `GraphPhysicsPlayground` is a pass-through to container (`src/playground/GraphPhysicsPlayground.tsx:5-6`).
4. `GraphPhysicsPlaygroundContainer` re-export path is `src/playground/modules/GraphPhysicsPlaygroundContainer.tsx:1`.
5. Real provider + runtime composition happens in `src/playground/GraphPhysicsPlaygroundShell.tsx:1491-1520`.

### A2) Providers/contexts used by Graph runtime path

#### Runtime-local providers mounted by container
1. `DocumentProvider` mounted at `src/playground/GraphPhysicsPlaygroundShell.tsx:1503`.
- Consumed via `useDocument()` at `src/playground/GraphPhysicsPlaygroundShell.tsx:144`.
- Provider creates and owns worker client lifecycle (`src/store/documentStore.tsx:94-99`).

2. `PopupProvider` mounted at `src/playground/GraphPhysicsPlaygroundShell.tsx:1504`.
- Consumed via `usePopup()` at `src/playground/GraphPhysicsPlaygroundShell.tsx:145`.
- Required by popup surfaces (`src/popup/PopupPortal.tsx:22`, `src/popup/NodePopup.tsx:140`, `src/popup/MiniChatbar.tsx:217`).

3. `FullChatProvider` mounted at `src/playground/GraphPhysicsPlaygroundShell.tsx:1505`.
- Consumed via `useFullChat()` at `src/playground/GraphPhysicsPlaygroundShell.tsx:146`.
- Required by full chat surfaces (`src/fullchat/FullChatToggle.tsx:43`, `src/fullchat/FullChatbar.tsx:60`).

#### Upstream app providers required by graph children
4. `AuthProvider` at app root (`src/main.tsx:17-19`).
- `SessionExpiryBanner` in graph tree uses `useAuth()` (`src/playground/GraphPhysicsPlaygroundShell.tsx:1340`, `src/auth/SessionExpiryBanner.tsx:8`).

5. `TooltipProvider` wraps `AppShell` (`src/screens/AppShell.tsx:370`, `src/screens/AppShell.tsx:465`).
- Tooltip layer currently portals to body (`src/ui/tooltip/TooltipProvider.tsx:99-103`).

### A3) Global assumption dependencies used from inside graph runtime tree
1. Fullscreen controller singleton (not React context, but runtime dependency in overlays):
- `CanvasOverlays` uses `useFullscreen()` (`src/playground/components/CanvasOverlays.tsx:18`, `src/playground/components/CanvasOverlays.tsx:180`).
- `useFullscreen` uses module singleton `fullscreenControllerSingleton` (`src/hooks/useFullscreen.ts:3`).
- Singleton attaches `document.addEventListener('fullscreenchange', ...)` in constructor (`src/hooks/useFullscreen.ts:18`).
- Fullscreen entry is global (`document.documentElement.requestFullscreen`) (`src/hooks/useFullscreen.ts:43`).

2. Graph runtime dev globals:
- Exposes engine to `window.__engine` in dev mode (`src/playground/GraphPhysicsPlaygroundShell.tsx:141-142`).
- Dev helper modules imported for console side effects in dev (`src/playground/GraphPhysicsPlaygroundShell.tsx:44-47`).

### A4) Minimal embed contract (for 1:1 mount)

Required props (operationally mandatory):
1. `pendingAnalysisPayload` and `onPendingAnalysisConsumed` (`src/playground/GraphPhysicsPlaygroundShell.tsx:53-55`).
2. Canonical restore path props: `pendingLoadInterface`, `onPendingLoadInterfaceConsumed` (`src/playground/GraphPhysicsPlaygroundShell.tsx:57-58`).
3. Read-path and save callbacks to preserve behavior parity: `onRestoreReadPathChange`, `onSavedInterfaceUpsert`, `onSavedInterfaceLayoutPatch` (`src/playground/GraphPhysicsPlaygroundShell.tsx:59-65`).
4. Product parity flag: `enableDebugSidebar={false}` on real graph screen (`src/screens/appshell/render/renderScreenContent.tsx:68`).

Required wrappers:
1. Runtime local: `DocumentProvider`, `PopupProvider`, `FullChatProvider` (`src/playground/GraphPhysicsPlaygroundShell.tsx:1503-1505`).
2. App level: `AuthProvider` and `TooltipProvider` (`src/main.tsx:17`, `src/screens/AppShell.tsx:370`).

Required DOM roots and host assumptions:
1. Non-zero canvas container is required each frame; 0x0 is explicitly skipped (`src/playground/rendering/graphRenderingLoop.ts:333-336`).
2. Current runtime assumes `document.body` portal host for popup/tooltips/glyph/login overlay (section B).

Non-optional side effects on mount:
1. `PhysicsEngine` lazy instantiation in component (`src/playground/GraphPhysicsPlaygroundShell.tsx:136-139`).
2. RAF render loop started through `useGraphRendering` (`src/playground/useGraphRendering.ts:159-183`).
3. Default random spawn path runs when no pending restore (`src/playground/GraphPhysicsPlaygroundShell.tsx:775-790`).
4. Global tick bus dispatch each frame: `graph-render-tick` (`src/playground/rendering/graphRenderingLoop.ts:567-569`).

## B. Exhaustive Escape Hatch Inventory (Portals + Fixed Overlays)

### B1) All `createPortal` usage in repo
1. `src/auth/LoginOverlay.tsx:179`
- Target: `document.body`
- Renders: auth overlay/backdrop/card
- Escape risk for preview: yes

2. `src/ui/tooltip/TooltipProvider.tsx:99-103`
- Target: `document.body`
- Renders: tooltip layer
- Escape risk for preview: yes

3. `src/popup/PopupOverlayContainer.tsx:31-35`
- Target: `document.body`
- Renders: popup overlay host (`NodePopup`, `MiniChatbar` via `src/popup/PopupPortal.tsx:30-38`)
- Escape risk for preview: critical yes

4. `src/playground/components/AIActivityGlyph.tsx:59-70`
- Target: `document.body`
- Renders: AI activity glyph
- Escape risk for preview: yes

### B2) All `position: 'fixed'` surfaces found

Graph runtime path and tightly-coupled graph UI:
1. `src/popup/PopupOverlayContainer.tsx:17` (full-screen host)
2. `src/popup/NodePopup.tsx:13` (full-screen backdrop)
3. `src/popup/MiniChatbar.tsx:33` (fixed chatbar)
4. `src/popup/ChatShortageNotif.tsx:23` (fixed notice)
5. `src/playground/components/AIActivityGlyph.tsx:13` (fixed glyph)
6. `src/fullchat/FullChatToggle.tsx:13` (fixed fullchat toggle)
7. `src/playground/components/CanvasOverlays.tsx:447` (fixed dots menu)
8. `src/playground/graphPlaygroundStyles.ts:43` (fixed debug overlay style)

Shared overlays that may coexist while prompt/preview exists:
9. `src/auth/LoginOverlay.tsx:183`
10. `src/ui/tooltip/TooltipProvider.tsx:43`
11. `src/ui/tooltip/TooltipProvider.tsx:50`
12. `src/screens/appshell/overlays/ModalLayer.tsx:476`
13. `src/screens/appshell/overlays/ModalLayer.tsx:605`
14. `src/screens/appshell/overlays/ModalLayer.tsx:686`
15. `src/screens/appshell/overlays/ModalLayer.tsx:755`
16. `src/screens/appshell/overlays/OnboardingChrome.tsx:37`
17. `src/components/Sidebar.tsx:1639`
18. `src/components/Sidebar.tsx:1681`
19. `src/components/Sidebar.tsx:1756`
20. `src/components/BalanceBadge.tsx:65`
21. `src/components/PaymentGopayPanel.tsx:299`
22. `src/components/PaymentGopayPanel.tsx:314`
23. `src/components/MoneyNoticeStack.tsx:55`
24. `src/components/ShortageWarning.tsx:85`
25. `src/screens/Welcome1.tsx:242`
26. `src/screens/EnterPrompt.tsx:187`
27. `src/screens/EnterPrompt.tsx:227`

### B3) Position computation model for fixed overlays
1. Viewport-based clamping by `window.innerWidth/innerHeight`:
- `NodePopup` (`src/popup/NodePopup.tsx:104-105`)
- `MiniChatbar` (`src/popup/MiniChatbar.tsx:141-142`)
- `ChatShortageNotif` (`src/popup/ChatShortageNotif.tsx:86`, `src/popup/ChatShortageNotif.tsx:91`, `src/popup/ChatShortageNotif.tsx:94`)
- `CanvasOverlays` dots menu (`src/playground/components/CanvasOverlays.tsx:118`, `src/playground/components/CanvasOverlays.tsx:128`, `src/playground/components/CanvasOverlays.tsx:132`)

2. Trigger rect + viewport strategy:
- Sidebar menus (`src/components/Sidebar.tsx:226-228`, `src/components/Sidebar.tsx:252-257`, `src/components/Sidebar.tsx:279-281`, `src/components/Sidebar.tsx:308`, `src/components/Sidebar.tsx:320`, `src/components/Sidebar.tsx:372`)

Containment verdict:
- Current portal + fixed overlay strategy escapes any embedded preview box by default.

## C. Exhaustive Global Listeners / Side Effects Inventory

### C1) Graph runtime listeners and loops

1. `src/playground/GraphPhysicsPlaygroundShell.tsx`
- `ResizeObserver` attach/cleanup: `287-290`.
- `window.blur` attach/cleanup: `518-519`.
- `window.keydown` capture attach/cleanup: `547-548`.
- Input guard for typing safety: `529-537`.

2. `src/playground/rendering/graphRenderingLoop.ts`
- RAF loop start: `633`; per-frame requeue: `575`; cancel: `647`.
- `window.blur` attach `581`, remove `645`.
- `canvas.addEventListener('wheel', ...)` attach `631`; no explicit remove in cleanup (`644-648`).
- `document.fonts.ready.then(...)` at `640` and `document.fonts.addEventListener('loadingdone', ...)` at `641`; no explicit remove in cleanup (`644-648`).

3. `src/playground/components/CanvasOverlays.tsx`
- `window.resize` attach/remove: `204-205`.
- `window.resize` + `window.scroll` attach/remove: `218-223`.
- `window.pointerdown` + `window.keydown` capture attach/remove: `243-247`.

4. `src/popup/NodePopup.tsx`
- Timers: `setTimeout` at `149-150` and `198` with cleanup paths present.
- `window.keydown` attach/remove: `171-172`.
- `window.graph-render-tick` attach/remove: `376-378`.

5. `src/popup/MiniChatbar.tsx`
- Startup timeout: `221` with cleanup `222`.
- `window.resize` attach/remove: `240-241`.
- RAF + timeout inside fade loop: `282`, `289` with cleanup `301-303`.
- `window.graph-render-tick` attach/remove: `346-347`.

6. `src/popup/ChatShortageNotif.tsx`
- Hide timeout: `57` with cleanup `57-63`.
- RAF schedule: `104` with cleanup `102-105` and `115`.
- `window.resize`, `window.scroll`, `window.graph-render-tick` attach `109-111`, remove `117-119`.

7. `src/fullchat/FullChatToggle.tsx`
- `window.resize` attach/remove: `53-54`.

8. `src/fullchat/FullChatbar.tsx`
- RAF usage: `293`, `332`, `520` with cancellation refs in cleanup paths.
- Timers: `383`, `424`, `597`, `699` with cleanup handling across effects.
- `document.visibilitychange` attach/remove: `577-578`.
- `window.resize` attach/remove: `608-610`.

9. `src/hooks/useFullscreen.ts`
- Global singleton attaches `document.fullscreenchange` at `18`.
- No explicit detach path by design (singleton lifetime = app lifetime).

### C2) Prompt/onboarding listeners that affect embedded preview behavior
1. Onboarding wheel guard:
- `window.addEventListener('wheel', ..., { passive:false, capture:true })` at `src/screens/appshell/transitions/useOnboardingWheelGuard.ts:23`.
- Cleanup at `src/screens/appshell/transitions/useOnboardingWheelGuard.ts:25`.
- Effect body always `preventDefault()` while active (`src/screens/appshell/transitions/useOnboardingWheelGuard.ts:13-19`).
- Risk: blocks graph wheel interactions on EnterPrompt preview unless scoped.

2. Prompt card global click handler:
- `document.mousedown` attach/remove at `src/components/PromptCard.tsx:51-53`.

### C3) Cleanup correctness summary
1. Confirmed cleanup gaps:
- `canvas.wheel` listener in `graphRenderingLoop`.
- `document.fonts.loadingdone` listener in `graphRenderingLoop`.
2. Multi-instance risk:
- Global window event channel `graph-render-tick` is shared by all mounted instances.

## D. Multi-Instance Collision Audit (Preview + Main Graph overlap)

### D1) Module-level singletons / global mutable state used by graph path
1. Topology singleton:
- `currentTopology` (`src/graph/topologyControl.ts:39`)
- `topologyVersion` (`src/graph/topologyControl.ts:45`)
- Classification: must be per-instance for true overlap; otherwise enforce strict no-overlap lifecycle.

2. Render generation singleton:
- `globalSurfaceGeneration` (`src/playground/rendering/graphRenderingLoop.ts:83`)
- Classification: risky shared mutable for overlap.

3. Render cache singletons:
- `gradientCache` (`src/playground/rendering/gradientCache.ts:76`)
- `textMetricsCache` (`src/playground/rendering/textCache.ts:56`)
- Classification: acceptable singleton only if overlap policy is strict; overlap can cause cross-instance cache churn.

4. Fullscreen singleton:
- `fullscreenControllerSingleton` (`src/hooks/useFullscreen.ts:3`)
- Classification: can remain singleton only if full-screen behavior is app-global and preview never tries isolated full-screen semantics.

5. Saved interface storage key singleton:
- `activeSavedInterfacesKey` (`src/store/savedInterfacesStore.ts:6`)
- Classification: app-level singleton; not graph-instance specific.

6. App-global money/topup stores and buses used by graph-coupled UI:
- `src/money/shortageStore.ts:16-24`
- `src/store/balanceStore.ts:14-22`
- `src/money/moneyNotices.ts:19-20`
- `src/money/topupEvents.ts:1`
- Classification: acceptable only if global UX is intentional; overlap can cross-trigger notices.

### D2) Global event bus usage
1. Producer: `window.dispatchEvent(new CustomEvent('graph-render-tick', ...))` (`src/playground/rendering/graphRenderingLoop.ts:567-569`).
2. Consumers:
- `src/popup/NodePopup.tsx:376-378`
- `src/popup/MiniChatbar.tsx:346-347`
- `src/popup/ChatShortageNotif.tsx:111-119`
3. Classification: must be per-instance for safe concurrent embed.

### D3) Additional global side effects in graph path
1. Dev download path appends hidden anchor to `document.body` then removes it (`src/playground/GraphPhysicsPlaygroundShell.tsx:741-748`).
2. Dev mode writes to `window.__engine` (`src/playground/GraphPhysicsPlaygroundShell.tsx:141-142`).

## E. Restore/Load Path Wiring for Sample JSON (Canonical Path Only)

### E1) Canonical restore flow from `pendingLoadInterface`
Effect starts at `src/playground/GraphPhysicsPlaygroundShell.tsx:799`.

Restore steps:
1. Guard pending + re-entry + AI busy checks (`800-805`).
2. Mark restore read path active (`807-810`) and consume pending intent (`812`).
3. Validate mandatory topology arrays (`816-818`).
4. Restore document/title/error baseline (`820-823`).
5. Canonical topology mutation via `setTopology(...)` (`825`) and fetch normalized topology (`826`).
6. Springs fallback derivation if missing (`827-830`).
7. Restore node state from topology + optional `analysisMeta` and optional `layout.nodeWorld` (`838-845`, `887-894`).
8. Restore optional camera snapshot (`846-851`, `925-930`).
9. Rehydrate engine + nodes and reset lifecycle (`944-949`).
10. Finalize flags and fallback handling (`956-965`).

### E2) Mandatory vs optional contract fields
Canonical contract type: `SavedInterfaceRecordV1` (`src/store/savedInterfacesStore.ts:20-47`).

Mandatory in typed contract and parser:
1. Record metadata fields: `id`, `createdAt`, `updatedAt`, `docId`, `title`, `source`, `preview`, `dedupeKey`.
2. Payload fields used by runtime: `parsedDocument`, `topology`.
3. Runtime hard guard specifically requires `topology.nodes` and `topology.links` arrays (`src/playground/GraphPhysicsPlaygroundShell.tsx:816-818`).

Optional:
1. `topology.springs` (derive fallback) (`src/playground/GraphPhysicsPlaygroundShell.tsx:827-830`).
2. `analysisMeta` (optional enrich) (`src/playground/GraphPhysicsPlaygroundShell.tsx:838-843`).
3. `layout` and `camera` (optional restore) (`src/playground/GraphPhysicsPlaygroundShell.tsx:844-851`).

### E3) Where `parseSavedInterfaceRecord` is called today
1. Outbox rehydrate parse: `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts:126`.
2. Remote payload parse: `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts:485`.

### E4) Dev JSON feed into canonical path (no parallel format)
Recommended canonical loading path:
1. Load dev JSON in prompt-side orchestration module (not graph runtime internals) and validate with `parseSavedInterfaceRecord`.
2. If valid, pass it as `pendingLoadInterface` through the same AppShell restore intent used by saved-interface selection.
3. Let existing restore effect in `GraphPhysicsPlaygroundShell` consume unchanged.

Sample compatibility note:
1. Existing export shape in graph runtime is `DevInterfaceExportV1` (`src/playground/GraphPhysicsPlaygroundShell.tsx:91-100`, export build at `src/playground/GraphPhysicsPlaygroundShell.tsx:720`).
2. This shape lacks required `SavedInterfaceRecordV1` metadata fields, so direct feed is not canonical without adapter.

## F. Embedding + Resize Readiness (Container-Scoped behavior)

### F1) Fullscreen/viewport assumptions currently present
1. Graph screen shell hardcodes `height: '100vh'` (`src/screens/appshell/render/GraphScreenShell.tsx:17`).
2. Loading screen uses viewport floor (`src/screens/LoadingScreen.tsx:9`).
3. Prompt/onboarding screens and prompt card use viewport min-height (`src/screens/EnterPrompt.tsx:176`, `src/components/PromptCard.tsx:240`).
4. Dots menu uses `maxHeight: calc(100vh - 40px)` (`src/playground/components/CanvasOverlays.tsx:514`).

### F2) What already supports container resize
1. Graph container is absolute-fill to parent (`src/playground/graphPlaygroundStyles.ts:14-18`).
2. Canvas is absolute-fill (`src/playground/GraphPhysicsPlaygroundShell.tsx:1341`).
3. Loop reads live canvas rect every frame (`src/playground/rendering/graphRenderingLoop.ts:333`).
4. 0x0 handling is explicit skip with retained last good surface (`src/playground/rendering/graphRenderingLoop.ts:333-336`, `src/playground/rendering/renderLoopSurface.ts:36-40`).
5. Surface resize path is rect-driven and cache-invalidating (`src/playground/rendering/renderLoopSurface.ts:8-67`).

### F3) What breaks when container shrinks/grows
1. Popup/chat overlays are viewport-based fixed layers (`src/popup/NodePopup.tsx:104-105`, `src/popup/MiniChatbar.tsx:141-142`, `src/popup/ChatShortageNotif.tsx:86-94`).
2. AI glyph uses viewport-relative `calc(50vw + 160px)` (`src/playground/components/AIActivityGlyph.tsx:15`).
3. Dots menu clamp logic uses viewport dimensions (`src/playground/components/CanvasOverlays.tsx:118-132`).

Camera/zoom note:
- Core camera transform uses canvas rect and does not inherently require full viewport; major embed issues are overlay and global channel assumptions.

## G. Perf + Focus Concerns (EnterPrompt typing while graph runs)

### G1) RAF and UI thread contention
1. Graph render loop is continuous while mounted (`src/playground/rendering/graphRenderingLoop.ts:633`, `src/playground/rendering/graphRenderingLoop.ts:575`).
2. EnterPrompt typing and graph loop share main thread, so preview-in-prompt increases contention risk.
3. Global per-frame event dispatch adds overhead (`src/playground/rendering/graphRenderingLoop.ts:567-569`).

### G2) Keyboard and typing interference
1. Graph registers global keydown capture (`src/playground/GraphPhysicsPlaygroundShell.tsx:547`).
2. It skips editable targets (`src/playground/GraphPhysicsPlaygroundShell.tsx:529-537`).
3. It still prevents default on some non-input keys (`src/playground/GraphPhysicsPlaygroundShell.tsx:541-543`).

### G3) Wheel conflict in EnterPrompt
1. Onboarding wheel guard blocks wheel globally while active (`src/screens/appshell/transitions/useOnboardingWheelGuard.ts:13-19`, `src/screens/appshell/transitions/useOnboardingWheelGuard.ts:23`).
2. This is a direct conflict for interactive wheel zoom in preview box.

## Blockers to 1:1 Embed (ranked)

Severity 1 (hard blockers):
1. Portal root override seam is missing (all major runtime overlays use `document.body` portals).
2. Per-instance tick channel seam is missing (`graph-render-tick` is global on `window`).
3. Topology store seam is missing (`topologyControl` is singleton global mutable).

Severity 2 (major correctness/perf risks):
1. Listener cleanup seam incomplete in `graphRenderingLoop` (`canvas.wheel`, `document.fonts.loadingdone`).
2. Viewport-fixed overlay geometry breaks container embedding.
3. Onboarding wheel guard blocks preview wheel input.

Severity 3 (policy-dependent risks):
1. Fullscreen singleton is app-global, not instance-scoped.
2. Money/topup global stores can cross-trigger if overlap is allowed.
3. Shared render caches/generation counters may cause cross-instance churn.

## Search Notes (commands used)
- `rg -n "createPortal" src`
- `rg -n "position:\s*'fixed'" src`
- `rg -n "window.addEventListener|document.addEventListener|document.fonts.addEventListener|canvas.addEventListener|requestAnimationFrame|setTimeout|setInterval|new ResizeObserver" src/playground src/popup src/fullchat src/screens/appshell/transitions src/components/PromptCard.tsx`
- `rg -n "window.innerWidth|window.innerHeight|getBoundingClientRect\(" src/playground src/popup src/fullchat src/components/Sidebar.tsx src/ui/tooltip/TooltipProvider.tsx src/auth/LoginOverlay.tsx src/screens/appshell/overlays src/screens/EnterPrompt.tsx`
- `rg -n "pendingLoadInterface|parseSavedInterfaceRecord|SavedInterfaceRecordV1|DevInterfaceExportV1|setTopology\(|patchTopology\(|getTopology\(" src`
- `rg -n "AuthProvider|TooltipProvider|SessionExpiryBanner|useAuth\(" src/main.tsx src/screens/AppShell.tsx src/playground/GraphPhysicsPlaygroundShell.tsx src/auth/SessionExpiryBanner.tsx src/ui/tooltip/TooltipProvider.tsx`
