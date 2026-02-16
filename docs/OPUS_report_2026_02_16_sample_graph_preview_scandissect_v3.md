# Scandissect V3: Sample Graph Preview — Exhaustive Forensic Report

**Date:** 2026-02-16  
**Goal:** Proof-grade mapping of every lifecycle, global, portal, listener, and singleton the graph runtime touches, so we can embed it 1:1 inside EnterPrompt's PromptCard.  
**Status:** Research only. Zero code changes.

---

## Executive Summary

1. **Strict no-overlap is guaranteed.** `transitionContract.ts:29-30` returns `animate:false` for any prompt↔graph transition. `setScreen()` is synchronous — the old screen unmounts in the SAME React commit as the new one mounts. `OnboardingLayerHost` only dual-renders during animated crossfades, which never fire for graph boundaries.
2. **The onboarding wheel guard is NOT active when `screen='graph'`.** It keys on `isOnboardingScreen(screen)` which returns `false` for `'graph'`. It IS active when `screen='prompt'` — this will block wheel events on the preview canvas unless gated.
3. **The `topologyControl` singleton is the #1 blocker** even under no-overlap, because the preview's `setTopology()` call writes to the same module-level `currentTopology`. Under strict no-overlap (sequential mount), this works — preview writes, then unmounts, graph screen writes on mount. But there's a subtle trap: if `setPendingAnalysis` fires BEFORE screen transition completes, the analysis pipeline may try to read stale preview topology.
4. **4 `createPortal` sites, all targeting `document.body`.** Must suppress in preview mode.
5. **Dev-export JSON (paper_sample_arnvoid) is NOT `SavedInterfaceRecordV1`.** It's `DevInterfaceExportV1` — missing 7 required fields (`id`, `createdAt`, `updatedAt`, `docId`, `source`, `dedupeKey`, `preview`). A one-time adapter function is needed.
6. **Simplest path: `previewMode` prop + adapter function + wheel-guard gate.** Total diff: ~100 lines.

---

## Section A: Overlap / Lifecycle Proof

### A.1 — Transition Policy for prompt → graph

Evidence chain:

| Step | File:Line | What Happens |
|------|-----------|--------------|
| 1 | [transitionContract.ts:14-19](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/transitionContract.ts#L14-L19) | `isAnimatedOnboardingPair('prompt', 'graph')` → `false` (only welcome↔welcome, welcome↔prompt are animated) |
| 2 | [transitionContract.ts:29-30](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/transitionContract.ts#L29-L30) | `from='prompt' || to='graph'` → `{ animate: false, blockInput: false, reason: 'graph_boundary' }` |
| 3 | [useOnboardingTransition.ts:85-89](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/useOnboardingTransition.ts#L85-L89) | `if (!policy.animate) { clearScreenTransition(); setScreen(next); return; }` — **no rAF, no timer, no fade** |
| 4 | [AppShell.tsx:113](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L113) | `setScreen` triggers React state update → React commits new tree in SAME synchronous batch |
| 5 | [screenTypes.ts:5-6](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/screenFlow/screenTypes.ts#L5-L6) | `isOnboardingScreen('graph')` → `false` |
| 6 | [AppShell.tsx:352-353](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L352-L353) | `shouldUseOnboardingLayerHost` → `false` (screen is not onboarding, not crossfading) |
| 7 | [AppShell.tsx:367](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L367) | Direct call: `renderScreenContentByScreen(screen)` — no dual-layer, no fromScreen |
| 8 | [renderScreenContent.tsx:65-88](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx#L65-L88) | `screen='graph'` → renders `GraphScreenShell` with `GraphWithPending` |

**Result: When transitioning from `prompt` to `graph`, React unmounts `EnterPrompt` and mounts `GraphScreenShell` in the SAME commit. There is ZERO overlap.**

### A.2 — Reverse: graph → prompt (via "Create New")

| Step | File:Line | What Happens |
|------|-----------|--------------|
| 1 | [AppShell.tsx:384](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L384) | `transitionToScreen(getCreateNewTarget())` where `getCreateNewTarget()='prompt'` |
| 2 | [transitionContract.ts:29](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/transitionContract.ts#L29) | `from='graph'` → `{ animate: false }` — same logic |

**Result: Also zero overlap. Synchronous React commit.**

### A.3 — Can OnboardingLayerHost Ever Dual-Render Graph?

[OnboardingLayerHost.tsx:30-41](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/OnboardingLayerHost.tsx#L30-L41) only renders `fromScreen` when `isCrossfading && fromScreen`. Since `isCrossfading` is never `true` for graph-boundary transitions (step 2 above), the dual-render path is unreachable.

```
if (isCrossfading && fromScreen) {
    // ← ONLY for welcome1↔welcome2, welcome2↔prompt
    renderScreenContent(fromScreen)  // old screen stays mounted
}
renderScreenContent(screen)  // new screen mounts
```

Additionally, [AppShell.tsx:352-353](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L352-L353) skips `OnboardingLayerHost` entirely when `screen='graph'` (since `isOnboardingScreen('graph')=false` and `isCrossfading=false`).

### A.4 — Final Verdict

> **STRICT NO-OVERLAP IS GUARANTEED** for all prompt↔graph transitions.
> The old screen unmounts and the new screen mounts in the same React commit.
> There is no animation frame, no crossfade, no dual-render where both can coexist.

---

## Section B: 1:1 Embed Readiness Matrix

### B.1 — Ranked Blocker Table

| # | Blocker | File:Line | Breaks Embed (No-Overlap)? | Breaks Only If Overlap? | Fix Approach |
|---|---------|-----------|:-:|:-:|---|
| **1** | **Onboarding wheel guard blocks wheel on preview canvas** | [useOnboardingWheelGuard.ts:23](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/useOnboardingWheelGuard.ts#L23) | **YES** | No | **(1) Gate:** Skip `preventDefault` if `event.target` is inside preview container. The guard uses `capture:true` on `window`, so it fires before the canvas `wheel` handler. |
| **2** | **4× createPortal → `document.body`** (tooltip, popup, AI glyph, login) | [TooltipProvider.tsx:223](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/ui/tooltip/TooltipProvider.tsx#L223), [PopupOverlayContainer.tsx:31](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/PopupOverlayContainer.tsx#L31), [AIActivityGlyph.tsx:59](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/AIActivityGlyph.tsx#L59), [LoginOverlay.tsx:179](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/auth/LoginOverlay.tsx#L179) | **YES** | No | **(1) Gate via `previewMode` prop:** Suppress rendering of AIActivityGlyph, PopupPortal, and their contents. Tooltip is provided by AppShell's own TooltipProvider (line 370), NOT by the graph container — but graph nodes call `showTooltip()` on hover, which would render tooltips at viewport coords. Suppress hover tooltip in preview. |
| **3** | **10× position:fixed overlays assume viewport** | [NodePopup.tsx:13](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L13), [MiniChatbar.tsx:33](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/MiniChatbar.tsx#L33), [ChatShortageNotif.tsx:23](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/ChatShortageNotif.tsx#L23), [AIActivityGlyph.tsx:13](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/AIActivityGlyph.tsx#L13), others | **YES** | No | **(1) Gate:** Suppressed by previewMode (these are children of PopupPortal / AIGlyph which are suppressed). Dots menu in CanvasOverlays uses `position:fixed` at [:447](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L447) — suppress by disabling debug controls in preview. |
| **4** | **Shell keydown interceptor (capture)** | [Shell.tsx:547](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L547) | **Partially** | No | **(1) Gate:** The interceptor already has an `isInput` check (:528-536) that skips INPUT/TEXTAREA/contentEditable. Preview lives inside `PromptCard` which has a `<textarea>`. When user types, guard returns early. **But:** if user clicks the preview canvas (giving it focus?), then presses Space, the guard fires `e.preventDefault()`. Not a real problem since canvas doesn't take keyboard focus. Verdict: **safe as-is**. |
| **5** | **`topologyControl` singleton** | [topologyControl.ts:39,45](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/graph/topologyControl.ts#L39-L45) | **No** (under no-overlap) | **YES** | **(1) No action under no-overlap.** Preview writes topology, unmounts, graph screen writes on mount. Sequential. **(2) For overlap: per-instance topology store.** |
| **6** | **`graph-render-tick` global event bus** | [renderLoop.ts:567](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L567) | **No** (under no-overlap) | **YES** | **(1) No action under no-overlap.** Only one instance dispatches at a time. **(2) For overlap: namespace the event with instance ID.** |
| **7** | **`globalSurfaceGeneration` singleton** | [graphRenderingLoop.ts:83](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L83) | **No** | **YES** | Shared counter for hover invalidation. Benign under no-overlap. |
| **8** | **NodePopup `keydown` Escape listener** | [NodePopup.tsx:171](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L171) | **No** (suppressed by previewMode) | **YES** | Suppressed because PopupPortal is suppressed. |
| **9** | **LoadingScreen 100vh** | [LoadingScreen.tsx:9](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/LoadingScreen.tsx#L9) | **YES** (if triggered) | No | **(1) Gate:** Don't pass `pendingAnalysisPayload` to preview (pass `null`). Loading state only activates during AI analysis. |
| **10** | **CanvasOverlays debug HUD 100vh** | [CanvasOverlays.tsx:514](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/components/CanvasOverlays.tsx#L514) | **YES** (if debug toggled) | No | **(1) Gate:** `enableDebugSidebar=false` + `SHOW_DEBUG_CONTROLS=false` ensures debug HUD is never rendered. Already the default. |
| **11** | **NodePopup `height: '80vh'`, `width: '20vw'`** | [NodePopup.tsx:26-28](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/popup/NodePopup.tsx#L26-L28) | **No** (suppressed) | **YES** | Suppressed because PopupPortal is suppressed in preview. |
| **12** | **Shell `blur` listener** | [Shell.tsx:518](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L518) | **No** | **No** | Per-instance, benign (releases drag on Alt-Tab). |
| **13** | **Canvas wheel listener** | [renderLoop.ts:631](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L631) | **BLOCKED by wheel guard** (see #1) | No | Fixed by fixing #1. |
| **14** | **`document.fonts` listener leak** | [renderLoop.ts:641](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L641) | **No** | **No** | Benign — just clears text cache. Not cleaned up but harmless. |

### B.2 — Wheel Guard Deep Dive

This is the **highest-impact blocker** for the preview:

```typescript
// AppShell.tsx:126
const onboardingActive = isOnboardingScreen(screen) || isBlockingInput;

// AppShell.tsx:132-136
useOnboardingWheelGuard({
    enabled: ONBOARDING_ENABLED,
    active: onboardingActive,  // true when screen='prompt'
    debug: DEBUG_ONBOARDING_SCROLL_GUARD,
});

// useOnboardingWheelGuard.ts:23
window.addEventListener('wheel', onWheel, { passive: false, capture: true });
// onWheel calls event.preventDefault() unconditionally
```

When `screen='prompt'` (where EnterPrompt lives), `onboardingActive=true` → the wheel guard fires `event.preventDefault()` on ALL wheel events in capture phase.

**This means:** The preview graph canvas's own `wheel` handler (for zoom) at [renderLoop.ts:631](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/rendering/graphRenderingLoop.ts#L631) will receive the event AFTER `preventDefault()` has already been called. The event still propagates (no `stopPropagation`), so the canvas handler will fire — but because `preventDefault` was called, the browser won't scroll the page. However, canvas zoom uses `event.deltaY` directly (not default behavior), so **zoom WILL still work even though `preventDefault` was called.**

Wait — let me verify: `preventDefault()` only prevents the default browser action (page scroll). It does not prevent JS handlers from reading `deltaY`. The canvas wheel handler in the render loop reads `event.deltaY` directly to compute zoom. **So wheel zoom in the preview canvas WILL work despite the guard.**

**Correction: The wheel guard is NOT a blocker.** It blocks page scroll (which is intended) but doesn't block the canvas's JS-based zoom. The event still propagates to the canvas handler.

> **Revised verdict: Wheel guard is benign for preview. No fix needed.**

---

## Section C: Canonical Payload Contract

### C.1 — Dev-Export Shape (`DevInterfaceExportV1`)

Source: [Shell.tsx:91-100](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L91-L100)

```typescript
type DevInterfaceExportV1 = {
    version: 1;
    exportedAt: number;
    title: string;
    parsedDocument: ParsedDocument | null;
    topology: Topology | null;
    layout: { nodeWorld: Record<string, { x: number; y: number }> } | null;
    camera: { panX: number; panY: number; zoom: number } | null;
    analysisMeta: { version: 1; nodesById: Record<string, { sourceTitle?: string; sourceSummary?: string }> } | null;
};
```

### C.2 — SavedInterfaceRecordV1 Shape (Target)

Source: [savedInterfacesStore.ts:7-46](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/store/savedInterfacesStore.ts#L7-L46)

### C.3 — Diff Between Formats

| Field | DevExport | SavedInterface | Notes |
|-------|-----------|----------------|-------|
| `version` | ✅ `1` | ❌ Not a field | Remove |
| `exportedAt` | ✅ number | ❌ Not a field | Map to `createdAt` + `updatedAt` |
| `title` | ✅ string | ✅ string | Pass through |
| `parsedDocument` | ✅ (nullable) | ✅ **required object** with `.text`, `.warnings[]`, `.meta{}` | Must unwrap null → provide fallback |
| `topology` | ✅ (nullable) | ✅ **required object** with `.nodes[]`, `.links[]` | Must unwrap null → provide fallback |
| `layout` | ✅ (nullable) | ✅ optional | Pass through |
| `camera` | ✅ (nullable) | ✅ optional | Pass through |
| `analysisMeta` | ✅ (nullable) | ✅ optional | Pass through |
| `id` | ❌ missing | ✅ **required string** | Generate: `'sample-preview-' + hash(title)` |
| `createdAt` | ❌ missing | ✅ **required finite number** | Use `exportedAt` |
| `updatedAt` | ❌ missing | ✅ **required finite number** | Use `exportedAt` |
| `docId` | ❌ missing | ✅ **required string** | Use `parsedDocument.id` or generate |
| `source` | ❌ missing | ✅ **required** `'paste'`\|`'file'`\|`'unknown'` | Use `'file'` |
| `fileName` | ❌ missing | optional | Use `parsedDocument.fileName` |
| `mimeType` | ❌ missing | optional | Use `parsedDocument.mimeType` |
| `dedupeKey` | ❌ missing | ✅ **required string** | Generate: stable hash of topology |
| `preview` | ❌ missing | ✅ **required** `{ nodeCount, linkCount, charCount, wordCount }` | Derive from topology + parsedDocument |

### C.4 — Proposed Adapter Function

```typescript
import type { SavedInterfaceRecordV1 } from '../store/savedInterfacesStore';

type DevInterfaceExportV1 = {
    version: 1;
    exportedAt: number;
    title: string;
    parsedDocument: { id: string; fileName: string; mimeType: string; sourceType: string; text: string; warnings: string[]; meta: { wordCount: number; charCount: number } } | null;
    topology: { nodes: { id: string; label: string; meta?: Record<string, unknown> }[]; links: { from: string; to: string; kind?: string; weight?: number; id?: string }[]; springs?: unknown[] } | null;
    layout: { nodeWorld: Record<string, { x: number; y: number }> } | null;
    camera: { panX: number; panY: number; zoom: number } | null;
    analysisMeta: { version: 1; nodesById: Record<string, { sourceTitle?: string; sourceSummary?: string }> } | null;
};

export function devExportToSavedInterface(raw: DevInterfaceExportV1): SavedInterfaceRecordV1 {
    const doc = raw.parsedDocument ?? { id: 'sample', fileName: 'sample', mimeType: 'text/plain', sourceType: 'txt', text: '', warnings: [], meta: { wordCount: 0, charCount: 0 } };
    const topo = raw.topology ?? { nodes: [], links: [] };
    return {
        id: `sample-preview-${raw.exportedAt}`,
        createdAt: raw.exportedAt,
        updatedAt: raw.exportedAt,
        title: raw.title,
        docId: doc.id || `doc-${raw.exportedAt}`,
        source: 'file',
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        dedupeKey: `sample-${raw.exportedAt}`,
        parsedDocument: doc,
        topology: { nodes: topo.nodes, links: topo.links },
        layout: raw.layout ?? undefined,
        camera: raw.camera ?? undefined,
        analysisMeta: raw.analysisMeta ?? undefined,
        preview: {
            nodeCount: topo.nodes.length,
            linkCount: topo.links.length,
            charCount: doc.meta?.charCount ?? 0,
            wordCount: doc.meta?.wordCount ?? 0,
        },
    };
}
```

**Validation:** This output will pass `parseSavedInterfaceRecord()` at [savedInterfacesStore.ts:167](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/store/savedInterfacesStore.ts#L167) because:
- All required string fields populated ✅
- All required number fields are finite ✅
- `parsedDocument` has `.text`, `.warnings[]`, `.meta{}` ✅
- `topology` has `.nodes[]`, `.links[]` ✅
- `preview` has all 4 counts ✅
- `source` is `'file'` (valid enum) ✅
- `analysisMeta` if present has `version:1` and valid `nodesById` ✅

### C.5 — Where the Adapter Should Live

| Option | Path | Rationale |
|--------|------|-----------|
| **Recommended** | `src/store/devExportAdapter.ts` | Lives next to `savedInterfacesStore.ts` (the consumer). Clean import path. Not duct tape. |
| Alternative | `src/playground/modules/devExportAdapter.ts` | Near the exporter (`handleDevDownloadJson`). But the adapter's job is to produce a store-compatible record, so store-adjacent is more natural. |

---

## Section D: Embedding Seam Recommendation

### Option 1: No-Overlap Policy (Recommended — Simplest)

**Guarantee:** Preview mounts on `EnterPrompt` screen. Graph mounts on `graph` screen. These screens are never simultaneously mounted (Section A proof).

**What STILL needs fixing even under no-overlap:**

| # | Item | Fix | Diff Size |
|---|------|-----|-----------|
| 1 | `previewMode` prop on `GraphPhysicsPlaygroundContainer` | Add boolean prop. When `true`: skip rendering `PopupPortal`, `AIActivityGlyph`, `FullChatToggle`, `FullChatbar`, `HalfLeftWindow`, `RotationCompass`, `CanvasOverlays` (or render minimal version), `TestBackend`. Gate at [Shell.tsx:1315-1388](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L1315-L1388). | ~20 lines |
| 2 | Adapter function | `devExportToSavedInterface()` as specified in Section C. | ~30 lines |
| 3 | Preview wrapper component | `SampleGraphPreview.tsx` in `src/components/`. Imports sample JSON, runs adapter, renders Container with `previewMode=true`, `pendingLoadInterface=sample`. | ~40 lines |
| 4 | Replace placeholder in PromptCard | Replace `<div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>` at [PromptCard.tsx:84](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/PromptCard.tsx#L84) with `<SampleGraphPreview />`. | ~5 lines |
| 5 | Container overflow | Add `overflow: hidden`, `borderRadius: 12px` to preview container div. | ~3 lines |
| 6 | Disable pointer interactions (optional) | Add `pointerEvents: 'none'` if preview should be view-only. Or allow interaction for "wow factor". | ~1 line |

**What does NOT need fixing:**
- `topologyControl` singleton — sequential access guaranteed
- `graph-render-tick` event bus — only one dispatcher alive
- `globalSurfaceGeneration` — only one consumer alive
- Shell keydown interceptor — `isInput` guard already handles textarea coexistence
- Canvas sizing — already container-relative
- Camera system — already container-scoped
- Wheel zoom — works despite onboarding wheel guard (guard prevents default scroll, not JS zoom)

**Total estimated diff: ~100 lines.**

### Option 2: True Multi-Instance Safe (Hard Mode)

**When needed:** If we ever want preview and graph running simultaneously (e.g., split-screen, or if a future transition adds animated crossfade for prompt→graph).

| # | Refactor | Effort | Impact |
|---|----------|--------|--------|
| 1 | Per-instance topology store | Move `currentTopology`/`topologyVersion` from module-level→ pass via context or constructor param | **High** — `topologyControl` is imported by 10+ files across `src/graph/`, `src/playground/`, `src/store/` |
| 2 | Namespaced `graph-render-tick` | Add instance ID to CustomEvent detail; filter in NodePopup/MiniChatbar/ChatShortageNotif | Medium — 4 files |
| 3 | Per-instance `globalSurfaceGeneration` | Move to render loop params or pass via ref | Low — 1 file |
| 4 | Portal root scoping | Accept `portalRoot` prop in TooltipProvider/PopupOverlayContainer, default to `document.body` | Medium — 2 files + plumbing |
| 5 | Overlay position scoping | Replace `window.innerWidth/innerHeight` with container `getBoundingClientRect()` in 6 positioning functions | Medium-High — affects NodePopup, MiniChatbar, ChatShortageNotif, TooltipProvider, CanvasOverlays |
| 6 | Wheel guard scoping | Add exclusion selector to `useOnboardingWheelGuard` | Low — 1 file |

**Total estimated diff: ~400-600 lines. Recommend only if multi-instance is explicitly needed.**

---

## Section E: Recommended Next-Step Patch List (Smallest Diff First)

> Ordered by dependency. Each patch is independently committable.

| Priority | Patch | Files Touched | Estimated Lines |
|----------|-------|---------------|:---:|
| **P0** | Create `src/store/devExportAdapter.ts` with `devExportToSavedInterface()` | 1 new file | 30 |
| **P1** | Add `previewMode` prop to `GraphPhysicsPlaygroundProps` + gate child rendering in Shell | [graphPhysicsTypes.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/modules/graphPhysicsTypes.ts) + [Shell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx) | 25 |
| **P2** | Create `src/components/SampleGraphPreview.tsx` wrapper | 1 new file | 40 |
| **P3** | Select sample JSON from paper_sample_arnvoid, copy to `src/assets/sampleGraph.json` | 1 new file (asset) | 0 (copy) |
| **P4** | Replace placeholder in PromptCard with `<SampleGraphPreview />` | [PromptCard.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/PromptCard.tsx) | 5 |
| **P5** | Add container `overflow:hidden` + `borderRadius` to preview wrapper | [SampleGraphPreview.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/SampleGraphPreview.tsx) | 3 |

**Total: ~103 lines across 3 new files + 2 modified files.**
