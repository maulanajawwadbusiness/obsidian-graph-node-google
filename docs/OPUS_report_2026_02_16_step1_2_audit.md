# Step 1–2 Audit Report: Sample Graph Preview

**Date:** 2026-02-16  
**Scope:** Verify correctness of SampleGraphPreview mount + PromptCard swap + seam helper.

---

## A) Looks Correct ✅

| Item | Evidence |
|------|----------|
| **PromptCard is the only preview location** | `GRAPH_PREVIEW_PLACEHOLDER_STYLE` defined once at [PromptCard.tsx:273](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/PromptCard.tsx#L273). `<SampleGraphPreview />` rendered once at [PromptCard.tsx:89](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/PromptCard.tsx#L89). No other files reference this placeholder. No conditional rendering variants. |
| **Outer wrapper geometry preserved** | `GRAPH_PREVIEW_PLACEHOLDER_STYLE` unchanged: `width: '100%', height: '200px', borderRadius: '12px', border, background, display:flex, alignItems/justifyContent:center`. Only the inner content swapped from text label → `<SampleGraphPreview />`. |
| **Real runtime mounted, not a toy** | `SampleGraphPreview.tsx:68` mounts `<GraphPhysicsPlayground>` which is a thin wrapper ([GraphPhysicsPlayground.tsx:5-7](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlayground.tsx#L5-L7)) that renders `GraphPhysicsPlaygroundContainer`. This is the identical component chain used by the main Graph screen at [renderScreenContent.tsx:72](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx#L72). |
| **No provider bypass** | `GraphPhysicsPlaygroundContainer` ([Shell.tsx:1491-1521](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1491-L1521)) wraps with `DocumentProvider` → `PopupProvider` → `FullChatProvider`. These are instantiated per-mount, so preview gets its own instances. No providers are skipped. |
| **No fullscreen shell included** | `SampleGraphPreview.tsx` does NOT wrap in `GraphScreenShell` (which adds `100vh`). The preview goes directly to `GraphPhysicsPlayground`. Correct. |
| **Optional props are truly optional** | All props beyond `pendingAnalysisPayload` + `onPendingAnalysisConsumed` are marked `?:` in [Shell.tsx:55-67](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L55-L67). No runtime exceptions from missing optional props. |
| **Error boundary wrapping** | `PreviewErrorBoundary` ([SampleGraphPreview.tsx:40-56](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/SampleGraphPreview.tsx#L40-L56)) catches runtime crashes gracefully. Good defensive move. |
| **Container sizing** | `PREVIEW_ROOT_STYLE`: `position:relative, width/height:100%, overflow:hidden, borderRadius:inherit`. `PREVIEW_SURFACE_STYLE`: `position:absolute, inset:0, width/height:100%`. This correctly fills the 200px parent. Canvas uses `getBoundingClientRect()` so it's container-scoped. |
| **Seam helper is clean** | `sampleGraphPreviewSeams.ts` exports data attribute + CSS selector + `isInsideSampleGraphPreviewRoot()`. Correct implementation using `Element.closest()`. Ready for future wheel-guard gating. |
| **Keyboard safety** | Graph's global keydown interceptor ([Shell.tsx:526-548](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L526-L548)) has `isInput` guard: `target.tagName === 'TEXTAREA'` → returns early. PromptCard has a `<textarea>` at [:132](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/PromptCard.tsx#L132). **Typing will NOT be intercepted.** |
| **No-overlap lifecycle** | Confirmed in V3 report: `transitionContract.ts:29-30` → `animate:false` for prompt↔graph → synchronous `setScreen()` → same React commit unmount/mount. Zero dual-instance risk. |

---

## B) Potential Issues ⚠️

### B1. 🔴 No `previewMode` gating — overlays WILL render and escape the preview box

**Severity: HIGH — visible to user.**

The preview mounts the full runtime with zero suppression. The following children render inside `GraphPhysicsPlaygroundInternal` and will appear on screen:

| Overlay | Shell Line | Risk |
|---------|-----------|------|
| `<AIActivityGlyph />` | [Shell.tsx:1384](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1384) | Portals to `document.body` with `position:fixed, zIndex:9999`. Currently invisible because `aiActivity=false` (no pending analysis), but if WorkerClient fires spurious events during init, it would render at viewport top-right. **Dormant risk.** |
| `<PopupPortal />` | [Shell.tsx:1387](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1387) | Portals to `document.body`. If user clicks a node → NodePopup renders fullscreen overlay at viewport coordinates. **Active risk if user interacts with preview.** |
| `<CanvasOverlays />` | [Shell.tsx:1342-1382](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1342-L1382) | Has a "3-dots" menu with `position:fixed`. Won't show unless user right-clicks / long-presses, but the CanvasOverlay dots button IS rendered at the bottom of the canvas. **Visible clutter.** |
| `<RotationCompass />` | [Shell.tsx:1388](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1388) | Positioned inside the canvas div. Will render if rotation is non-zero. **Low risk — clipped by overflow:hidden on root.** |
| `<SessionExpiryBanner />` | [Shell.tsx:1340](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1340) | Renders inline at top of canvas. **Would show inside preview if session expiring.** |
| `<HalfLeftWindow />` | [Shell.tsx:1320-1327](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1320-L1327) | Inline document viewer. Won't open unless `documentContext.state.previewOpen=true`. **Safe — defaults to closed.** |
| `<FullChatToggle />` | [Shell.tsx:1459](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1459) | Only renders if `FULLCHAT_ENABLED=true`. If enabled, shows a floating button inside the canvas area. **May be visible inside the 200px box.** |
| `<LoadingScreen />` | [Shell.tsx:1314-1315](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1314-L1315) | Only renders if `isGraphLoading=true`. Since `pendingAnalysisPayload=null`, `documentContext.state.aiActivity` is `false`. **Safe — won't trigger.** |

### B2. 🟡 Preview shows random default spawn, not sample data

**Severity: MEDIUM — not matching intended UX.**

Since no `pendingLoadInterface` is passed, the init logic at [Shell.tsx:775-789](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L775-L789) falls through to `runDefaultSpawnOnce('init')` → `spawnGraph(4, 1337)` → renders a random 4-node graph with generic labels ("Node 1", "Node 2", etc).

This is deterministic (seed 1337), so it looks consistent across page loads. But it's NOT the sample paper data from `paper_sample_arnvoid/`. The nodes will have generic labels instead of paper-specific ones, and no node summaries/metadata will be present.

**Not a correctness bug** — the runtime works perfectly. It's a content/UX gap for step 3 (feeding sample JSON via adapter function).

### B3. 🟡 Wheel zoom: WORKS, but with a subtle wrinkle

**Severity: LOW — wheel zoom functions, but there's a side effect.**

The onboarding wheel guard ([useOnboardingWheelGuard.ts:23](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/useOnboardingWheelGuard.ts#L23)) fires `event.preventDefault()` in capture phase on ALL wheel events when `screen='prompt'`. However:

1. The canvas wheel handler at [graphRenderingLoop.ts:631](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L631) reads `event.deltaY` directly to compute zoom — `preventDefault()` only blocks browser defaults (scroll), not JS property access. **Zoom still works.**
2. But: any wheel-driven page scrolling that the user intends (if the prompt card ever scrolls) would be blocked even outside the preview. This is existing behavior from the onboarding guard, not new to preview.

**No action needed for wheel zoom specifically.**

### B4. 🟡 `topologyControl` singleton gets written by preview on init

**Severity: LOW (under no-overlap guarantee).**

`runDefaultSpawnOnce` calls `spawnGraph` which internally calls `setTopology()` → writes to `currentTopology` module-level singleton at [topologyControl.ts:39](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/graph/topologyControl.ts#L39). When user transitions to graph screen, the graph screen's own init will overwrite this. The preview's topology is harmlessly clobbered.

But: if any code reads `getTopology()` during the gap between preview mount and preview unmount (e.g., sidebar code), it would see the preview's topology. In practice, nothing in AppShell reads topology outside the graph screen.

### B5. 🟡 `window.addEventListener('keydown', capture:true)` installed by preview

**Severity: LOW — safe but adds a second listener.**

When preview mounts, `Shell.tsx:547` installs a capture-phase keydown listener on `window`. This listener calls `e.preventDefault()` on Space/Arrow keys unless `isInput=true`. Since the PromptCard's `<textarea>` satisfies the `isInput` check, typing is safe. But if user focuses a non-input element on the prompt screen and presses Space, the preview's interceptor will fire `preventDefault()`. This is unlikely but theoretically possible.

The listener IS cleaned up on unmount via the `useEffect` return.

### B6. 🟡 `window.addEventListener('blur')` installed by preview

**Severity: NONE — properly cleaned up.**

[Shell.tsx:518](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L518) — releases drag on blur. Cleaned up on unmount. No conflict.

### B7. 🟡 `graph-render-tick` CustomEvent dispatched by preview rAF loop

**Severity: LOW (under no-overlap guarantee).**

The render loop at [graphRenderingLoop.ts:567](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L567) dispatches `window.dispatchEvent(new CustomEvent('graph-render-tick'))` every frame. Since no second graph instance exists simultaneously (no-overlap), consumers of this event (NodePopup, MiniChatbar, ChatShortageNotif) won't be confused. The preview's own PopupPortal IS mounted, but since no popup is open, tick consumers are idle.

### B8. 🟡 DocumentProvider spawns a WorkerClient

**Severity: LOW — resource waste.**

`DocumentProvider` at mount creates a `WorkerClient` (web worker) for AI analysis. Since preview passes `pendingAnalysisPayload=null`, the worker sits idle. But it occupies a web worker slot and memory until unmount. On worker-constrained devices this could be marginal overhead.

---

## C) Must-Fix Before Step 3 🚨

| # | Issue | Why | Recommended Fix |
|---|-------|-----|-----------------|
| **C1** | **No `previewMode` prop gating** (B1) | PopupPortal + AIActivityGlyph + CanvasOverlays dots menu WILL render. If user clicks a node, a NodePopup will portal to `document.body` and appear fullscreen — visible UX bug. | Add `previewMode?: boolean` to `GraphPhysicsPlaygroundProps`. In `GraphPhysicsPlaygroundInternal` JSX, gate: `{!previewMode && <PopupPortal>}`, `{!previewMode && <AIActivityGlyph>}`, `{!previewMode && <CanvasOverlays>}` (or render a minimal version), `{!previewMode && FULLCHAT_ENABLED && <FullChatToggle>}`, `{!previewMode && <SessionExpiryBanner>}`. Pass `previewMode={true}` from SampleGraphPreview. |
| **C2** | **No sample data fed** (B2) | Preview shows random 4-node graph instead of paper sample data. | Create adapter function (`devExportToSavedInterface`), import sample JSON, pass via `pendingLoadInterface` prop. This was planned for a later step but should be wired before calling step 2 "complete". |

---

## D) OK to Defer 🟢

| # | Issue | Why Deferrable |
|---|-------|---------------|
| **D1** | Wheel guard not scoped to preview (B3) | Wheel zoom already works. Guard blocks page scroll globally on prompt screen regardless of preview — existing behavior. Seam helper (`isInsideSampleGraphPreviewRoot`) is ready for future gating if needed. |
| **D2** | topologyControl singleton written by preview (B4) | Under strict no-overlap, harmless. Only matters if multi-instance is ever needed. |
| **D3** | keydown interceptor adds second capture listener (B5) | isInput guard protects textarea. Edge case of Space on non-input is negligible. Cleaned up on unmount. |
| **D4** | Idle WorkerClient from DocumentProvider (B8) | Marginal memory/worker cost. Could later gate with `previewMode` to skip DocumentProvider entirely, but not blocking. |
| **D5** | graph-render-tick dispatched while on prompt (B7) | No consumers outside the preview's own tree are listening. Benign under no-overlap. |
| **D6** | `pointerEvents` on preview (currently interactive) | User can drag/click nodes in preview. Whether this is desired is a UX decision, not a correctness bug. If view-only is wanted, add `pointerEvents: 'none'` to `PREVIEW_SURFACE_STYLE`. |
| **D7** | rAF loop running at 60fps while user types | ~3-10ms per frame. On modern devices, no contention with textarea keystroke handling (~1ms). Could add `requestIdleCallback`-based throttling or `IntersectionObserver` pause when not visible, but premature optimization for now. |
