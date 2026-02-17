# B1 Nav Fade Design Report

**Date:** 2026-02-17  
**Scope:** Design-only — no code changes  
**Goal:** Propose the best bedrock approach to implement a lightweight 200ms fade for B1 navigation (prompt → sidebar/search → open existing saved graph), bypassing `GraphLoadingGate` entirely.

---

## 1. Current Codepoints Involved in B1

### The B1 Flow (existing, broken)

```
User clicks saved interface in sidebar
  → onSelectInterface(id)                                    [Sidebar.tsx:960]
  → AppShell.selectSavedInterfaceById(id)                    [AppShell.tsx:487-495]
    → setPendingLoadInterface(record)
    → if !isGraphClassScreen(screen):
        transitionWithPromptGraphGuard('graph')               [AppShell.tsx:491-493]
  → transitionWithPromptGraphGuard('graph')                  [AppShell.tsx:356-365]
    → reroutes prompt→graph to 'graph_loading'
    → transitionToScreen('graph_loading')
  → screen = 'graph_loading'
    → SIDEBAR_INTERACTION_BY_SCREEN['graph_loading'] = 'frozen'    [AppShell.tsx:105]
    → SIDEBAR_DIM_ALPHA_BY_SCREEN['graph_loading'] = 0.5          [AppShell.tsx:110]
    → sidebar force-collapsed                                      [AppShell.tsx:569-573]
    → GraphLoadingGate mounts (full opaque overlay + confirm)      [renderScreenContent.tsx:146-161]
    → gateEntryIntent = 'restore'                                  [graphLoadingGateMachine.ts:43]
    → gate phase machine runs (arming→loading→done→confirmed)
    → gate exit → transitionToScreen('graph')
```

### Key files & lines

| File | Lines | Role |
|------|-------|------|
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) | 487-495 | `selectSavedInterfaceById` — sets `pendingLoadInterface`, triggers transition |
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) | 356-365 | `transitionWithPromptGraphGuard` — reroutes `prompt→graph` to `graph_loading` |
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) | 565-583 | sidebar collapse + restore on graph_loading entry/exit |
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) | 606-621 | `gateEntryIntent` computation (analysis/restore/none) |
| [renderScreenContent.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx) | 146-161 | `GraphLoadingGate` conditional mount inside `GraphScreenShell` |
| [GraphLoadingGate.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/GraphLoadingGate.tsx) | 22-36, 123-283 | Gate overlay: `position:absolute; inset:0; z-index:10` |
| [graphLoadingGateMachine.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/graphLoadingGateMachine.ts) | 38-45, 47-80 | Gate phase machine + `getGateEntryIntent` (overreach: treats `restore` same as `analysis`) |
| [sidebarLockPolicy.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/sidebar/sidebarLockPolicy.ts) | 30-42 | Sidebar lock: `isFrozenByScreen` → `screen_frozen` |
| [GraphScreenShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/GraphScreenShell.tsx) | 38-82 | Graph screen layout: flex row with sidebar spacer + graph pane |

### The overreach

`transitionWithPromptGraphGuard` (L356-365) **always** reroutes `prompt→graph` to `graph_loading`, regardless of whether the intent is analysis or restore. This causes the full gate UX to activate for B1 (restore) just as it does for analysis.

---

## 2. Current Layering Tree

### DOM structure (AppShell render tree, L958-1106)

```
<div style={SHELL_STYLE}>                          ← position:relative (L73-77)
  │
  ├─ <SidebarLayer>                                 ← FIRST child
  │   └─ <aside data-sidebar-root="1">              ← position:absolute; left:0; top:0; bottom:0
  │       style = SIDEBAR_BASE_STYLE                    z-index: 50 (LAYER_SIDEBAR)
  │       onPointerDown: stopPropagation
  │       onWheel/onWheelCapture: stopPropagation
  │
  ├─ <div style={NON_SIDEBAR_LAYER_STYLE}>          ← SECOND child (no z-index, no position)
  │   ├─ <div data-main-screen-root="1"             ← position:relative (MAIN_SCREEN_CONTAINER_STYLE)
  │   │       style={MAIN_SCREEN_CONTAINER_STYLE}>
  │   │   └─ {screenContent}                         ← either OnboardingLayerHost or direct render
  │   │       └─ (when graph_class screen):
  │   │           <GraphScreenShell>                 ← position:relative; width:100%; height:100vh
  │   │             ├─ sidebar-pane spacer div       ← width matches sidebar, flex-shrink:0
  │   │             └─ graph-pane div                ← flex:1; position:relative
  │   │                 ├─ <GraphRuntimeLeaseBoundary>
  │   │                 │   └─ <GraphWithPending />  ← the actual graph canvas
  │   │                 └─ (if screen='graph_loading'):
  │   │                     <GraphLoadingGate />     ← position:absolute; inset:0; z-index:10
  │   │                                                pointer-events:auto; touch-action:none
  │   ├─ <OnboardingChrome />
  │   └─ {moneyUi}
  │
  └─ <ModalLayer />                                  ← THIRD child
      └─ search (z:3100), delete (z:3200),
         profile (z:3300), logout (z:3400)
```

### Z-index map

| Layer | z-index | Scope |
|-------|---------|-------|
| Graph pane content (canvas) | none (default) | inside `graph-pane` div |
| GraphLoadingGate | 10 | inside `graph-pane` div (absolute, covers graph pane only) |
| **Sidebar** | **50** | absolute from SHELL root, covers left edge |
| Sidebar row/avatar/more menus | 1400 | `position:fixed` |
| Onboarding fullscreen button | 1200 | — |
| Modal search | 3100 | — |
| Modal delete | 3200 | — |
| Modal profile | 3300 | — |
| Modal logout | 3400 | — |
| Tooltip | 3450 | — |
| Login overlay | 5000 | — |

### Key observations

1. **Sidebar is a sibling** of the `NON_SIDEBAR_LAYER` div, not a child. They are both direct children of `SHELL_STYLE` div.
2. **Sidebar z-index (50)** is higher than any content within `NON_SIDEBAR_LAYER` (which has no z-index).
3. **GraphLoadingGate z-index (10)** is scoped inside `graph-pane`, so it only covers the graph canvas area, not the sidebar. **However**, the sidebar is still affected because:
   - The sidebar gets **frozen** (`inert`, event blocking) by `sidebarLockPolicy`
   - The sidebar gets **dimmed** to alpha 0.5
   - The sidebar gets **force-collapsed**
4. A fade overlay placed **inside `NON_SIDEBAR_LAYER`** at any z-index ≤ 49 will naturally sit **below** the sidebar.

---

## 3. Existing Fade Primitives

### Available primitives

| Primitive | File | What it does | Reuse viability |
|-----------|------|------------|----------------|
| `OnboardingLayerHost` | [transitions/OnboardingLayerHost.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/OnboardingLayerHost.tsx) | Crossfade between two onboarding screens with opacity transition + input shield | ❌ Wrong scope — designed for onboarding-to-onboarding crossfade, not for content-area-only fade |
| `transitionContract.ts` | [transitions/transitionContract.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/transitionContract.ts) | `ONBOARDING_FADE_MS=200`, `getTransitionPolicy()`, `TransitionPhase` types | ✅ Tokens reusable (`200ms`, easing), policy model is good reference |
| `transitionTokens.ts` | [transitions/transitionTokens.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/transitionTokens.ts) | Exports `GRAPH_LOADING_SCREEN_FADE_MS=200`, `GRAPH_LOADING_SCREEN_FADE_EASING` | ✅ Exact tokens to reuse |
| `GraphLoadingGate` opacity fade | [render/GraphLoadingGate.tsx:190-194](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/GraphLoadingGate.tsx#L190-L194) | `opacity 0→1` on enter, `1→0` on exit, with `fadeMs` and `fadeEasing` | ⚠️ Same CSS pattern, but coupled to gate phase machine |

### Conclusion

No existing component does exactly what we need (a content-area-only fade overlay that doesn't touch sidebar). A **new minimal primitive** is required, but it should reuse the existing tokens (`GRAPH_LOADING_SCREEN_FADE_MS`, `GRAPH_LOADING_SCREEN_FADE_EASING`).

---

## 4. Recommended Approach: Content-Only Fade Overlay (Option A)

### Concept

Mount a **content-area fade overlay** inside the `NON_SIDEBAR_LAYER` div, above `screenContent` but below sidebar (z < 50). This overlay:
- Covers only the non-sidebar content area
- Fades opacity 1→0 over 200ms (or 0→1→0 for a dip pattern)
- Blocks pointer/wheel in the content area during fade
- Does NOT touch sidebar z-index, opacity, frozen state, or positioning

### Where to mount it

```
<div style={NON_SIDEBAR_LAYER_STYLE}>         ← existing container
  <div data-main-screen-root="1" ...>
    {screenContent}
  </div>
  <OnboardingChrome />
  {moneyUi}
  ▶ <ContentFadeOverlay />                     ← NEW: mounted here, inside NON_SIDEBAR_LAYER
</div>
```

### Why this location is safe

1. It's a **sibling** of `screenContent`, not a parent — no risk of remounting content.
2. It's **inside** `NON_SIDEBAR_LAYER`, so sidebar (z:50, absolute from shell root) is unaffected.
3. It can use `position:absolute; inset:0; z-index:40` (below sidebar's 50, above all content).
4. `pointer-events:auto` during fade blocks interaction with content but not sidebar.

### Component design

```tsx
// New file: src/screens/appshell/render/ContentFadeOverlay.tsx

type ContentFadePhase = 'idle' | 'fadingOut' | 'fadingIn';

type ContentFadeOverlayProps = {
  phase: ContentFadePhase;
  fadeMs?: number;
  fadeEasing?: string;
  onFadeOutComplete?: () => void;
};

// Renders a div with:
//   position: absolute; inset: 0; z-index: 40;
//   background: '#06060A';
//   pointer-events: phase !== 'idle' ? 'auto' : 'none'
//   opacity: phase === 'fadingOut' ? 1 : 0;
//   transition: opacity ${fadeMs}ms ${fadeEasing};
//   onTransitionEnd → call onFadeOutComplete when opacity reaches 0
// Returns null when phase === 'idle' (or keep mounted with opacity:0, pointer-events:none)
```

### Ownership & timing in AppShell

```tsx
// In AppShell.tsx, near selectSavedInterfaceById:

const [contentFadePhase, setContentFadePhase] = useState<ContentFadePhase>('idle');

const selectSavedInterfaceById = useCallback((id: string) => {
  const record = savedInterfaces.find(item => item.id === id);
  if (!record) return;

  // If coming from prompt screen, use lightweight fade instead of gate
  if (!isGraphClassScreen(screen)) {
    setContentFadePhase('fadingOut');        // Start 200ms fade to black

    // After fade completes (onFadeOutComplete callback):
    //   1. setPendingLoadInterface(record)
    //   2. transitionToScreen('graph')       ← DIRECT, skip graph_loading
    //   3. setContentFadePhase('fadingIn')   ← fade back from black

    // Store record in a ref so the callback can access it
    pendingRestoreRef.current = record;
    return;
  }

  // If already on graph screen, just swap (existing behavior, no fade needed)
  setPendingLoadInterface(record);
  console.log('[appshell] pending_load_interface id=%s', id);
}, [savedInterfaces, screen]);

const onContentFadeOutComplete = useCallback(() => {
  const record = pendingRestoreRef.current;
  pendingRestoreRef.current = null;
  if (!record) return;

  setPendingLoadInterface(record);
  transitionToScreen('graph');              // ← BYPASS graph_loading entirely
  setContentFadePhase('fadingIn');

  console.log('[B1Fade] restore_committed id=%s', record.id);
}, [transitionToScreen]);
```

### Timeline

```
t=0ms    User clicks saved interface in sidebar
         → contentFadePhase = 'fadingOut'
         → overlay opacity: 0 → 1 (200ms)
         → sidebar: UNTOUCHED (no freeze, no dim, no collapse)

t=200ms  onTransitionEnd fires
         → setPendingLoadInterface(record)
         → transitionToScreen('graph')  [direct, no graph_loading]
         → contentFadePhase = 'fadingIn'
         → overlay opacity: 1 → 0 (200ms)

t=400ms  Fade in complete
         → contentFadePhase = 'idle'
         → overlay unmounts (or stays mounted with opacity:0, pointer-events:none)
         → graph is fully visible with restored interface
```

### Input containment during fade

- Overlay has `pointer-events: auto` + `onPointerDown/onWheel: e.stopPropagation()` — blocks canvas/prompt input
- Overlay z-index (40) is below sidebar (50) — **sidebar receives all events normally**
- No `inert` attribute, no `frozen` flag, no dim alpha change on sidebar

---

## 5. Alternate Approach: Reuse GraphLoadingGate as Minimal Component (Option D)

### Concept

Create a `ContentRestoreFade` that reuses GraphLoadingGate's fade logic (opacity transition pattern) but:
- Strips out confirm button, back button, loading text, error handling
- Strips out sidebar freeze/dim/collapse side effects
- Keeps only the opacity 0→1→0 dip with 200ms timing

### Why rejected

1. **Coupling risk:** Even a "stripped" version of the gate creates conceptual coupling. Future changes to GraphLoadingGate (adding new phases, modifying timing) could accidentally affect the restore path.
2. **Sidebar side effects are baked into AppShell, not the gate component.** The gate itself doesn't freeze the sidebar — `AppShell.tsx` does (L565-583, L266-268). So "reusing gate fade logic" still requires de-coupling the sidebar effects, which means the same amount of AppShell surgery regardless.
3. **No extensibility.** A gate-based approach inherits gate semantics (phase machine, arming, watchdog). A clean new primitive is simpler and more reusable for future lightweight transitions.

> [!IMPORTANT]
> Option A (content-only fade overlay) is cleaner because it introduces zero coupling to the analysis path, and the sidebar de-coupling is a natural consequence of the mounting location rather than requiring explicit opt-outs.

---

## 6. Minimal Patch Plan (Pseudocode)

### Step 1: New component `ContentFadeOverlay.tsx`

```
[NEW] src/screens/appshell/render/ContentFadeOverlay.tsx
```

~40 lines. Stateless presentational component. Props: `phase`, `fadeMs`, `fadeEasing`, `onFadeOutComplete`, `onFadeInComplete`. Renders a positioned div with CSS opacity transition. Fires `onTransitionEnd` callbacks.

### Step 2: New token (or reuse existing)

Reuse `GRAPH_LOADING_SCREEN_FADE_MS` (200) and `GRAPH_LOADING_SCREEN_FADE_EASING` from [transitionTokens.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/transitions/transitionTokens.ts).

Optionally add a parallel export:

```ts
// In transitionTokens.ts
export const CONTENT_RESTORE_FADE_MS = 200;
export const CONTENT_RESTORE_FADE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
```

### Step 3: AppShell state + wiring

```
[MODIFY] src/screens/AppShell.tsx
```

- Add state: `contentFadePhase`, `pendingRestoreRef`
- Modify `selectSavedInterfaceById` to check `!isGraphClassScreen(screen)` and branch:
  - **If on prompt:** start fade, defer restore
  - **If already on graph:** do in-place restore (existing behavior, no gate/fade)
- Add `onContentFadeOutComplete` callback
- Mount `<ContentFadeOverlay>` inside the `NON_SIDEBAR_LAYER` div (after `{moneyUi}`)
- **Do NOT modify** `transitionWithPromptGraphGuard` — B1 now bypasses it entirely

### Step 4: Render integration

```
[MODIFY] src/screens/AppShell.tsx (render tree, ~L1046-1061)
```

```diff
 <div style={{ ...NON_SIDEBAR_LAYER_STYLE, ... }}>
     <div data-main-screen-root="1" style={MAIN_SCREEN_CONTAINER_STYLE}>
         {screenContent}
     </div>
     <OnboardingChrome ... />
     {moneyUi}
+    <ContentFadeOverlay
+        phase={contentFadePhase}
+        fadeMs={CONTENT_RESTORE_FADE_MS}
+        fadeEasing={CONTENT_RESTORE_FADE_EASING}
+        onFadeOutComplete={onContentFadeOutComplete}
+        onFadeInComplete={() => setContentFadePhase('idle')}
+    />
 </div>
```

### Step 5: Sidebar — no changes needed

The `selectSavedInterfaceById` path now calls `transitionToScreen('graph')` directly, **not** `transitionWithPromptGraphGuard`. Since `graph` is not `graph_loading`:
- `SIDEBAR_INTERACTION_BY_SCREEN['graph']` = `'active'` → no freeze
- `SIDEBAR_DIM_ALPHA_BY_SCREEN['graph']` = `1` → no dim
- `sidebarExpandedForRender` = `isSidebarExpanded` (not forced false) → no collapse

---

## 7. Z-Index / Layering Proof: Sidebar Safety

| Property | During B1 Fade (proposed) | During Analysis Gate (current) |
|----------|--------------------------|-------------------------------|
| Screen | `prompt` → `graph` (direct) | `prompt` → `graph_loading` → `graph` |
| Sidebar z-index | **50 (unchanged)** | 50 |
| Fade overlay z-index | **40** (inside NON_SIDEBAR_LAYER) | 10 (inside graph-pane) |
| Sidebar frozen | **No** | Yes |
| Sidebar dim alpha | **1.0** | 0.5 |
| Sidebar collapsed | **No** | Yes (force-collapsed) |
| Sidebar pointer-events | **auto** | auto but `inert` attribute set |
| Sidebar position | **absolute; left:0; top:0; bottom:0** | same |
| Overlay covers sidebar | **No** — overlay is inside NON_SIDEBAR_LAYER, sidebar is a sibling above it | No — gate is inside graph-pane |

### Why the sidebar is provably safe

1. **DOM hierarchy:** `SidebarLayer` and `NON_SIDEBAR_LAYER` are siblings under `SHELL_STYLE` div. The fade overlay is a child of `NON_SIDEBAR_LAYER`. A child cannot affect a sibling's stacking context.

2. **Z-index:** Sidebar is `z-index: 50` on an `absolutely` positioned element from `SHELL_STYLE`. The overlay is `z-index: 40` inside a non-positioned (`NON_SIDEBAR_LAYER_STYLE` has no position) container. Even if it were positioned, 40 < 50.

3. **No sidebar state changes:** The B1 path skips `graph_loading` entirely, so none of the sidebar side-effects trigger:
   - L565-583 (collapse on graph_loading entry) — **not reached**
   - L266 (`sidebarFrozen = SIDEBAR_INTERACTION_BY_SCREEN[screen]`) — `graph` → `'active'`, not frozen
   - L267 (`sidebarDimAlpha`) — `graph` → `1`, not dimmed
   - L268 (`sidebarExpandedForRender`) — only clamped for `graph_loading`, not `graph`

4. **Pointer containment:** Overlay captures `onPointerDown`, `onWheel` via `stopPropagation()`. Since sidebar already does its own `stopPropagation()` on all pointer/wheel events (Sidebar.tsx L753-755), and sidebar sits above the overlay in z-order, sidebar events are never intercepted.

---

## 8. DEV Logs / Counters to Verify Fade Triggers Only for B1

### Recommended logging

```ts
// In selectSavedInterfaceById, when B1 fade path is taken:
console.log('[B1Fade] fade_start id=%s fromScreen=%s', record.id, screen);

// In onContentFadeOutComplete:
console.log('[B1Fade] restore_committed id=%s', record.id);

// In onFadeInComplete (or idle transition):
console.log('[B1Fade] fade_complete id=%s duration=%dms', record.id, Date.now() - fadeStartTs);

// Invariant check — ensure gate is NOT activated for B1:
// In the effect at L606-621 where gateEntryIntent is set:
if (screen === 'graph_loading' && gateEntryIntent === 'restore') {
  console.warn('[B1Guard] INVARIANT_VIOLATION gate_activated_for_restore intent=%s', gateEntryIntent);
}
```

### Debug counters (window.__arnvoidDebugCounters)

```ts
counters.b1FadeStartCount = (counters.b1FadeStartCount ?? 0) + 1;
counters.b1FadeCompleteCount = (counters.b1FadeCompleteCount ?? 0) + 1;
// Compare with counters.graphLoadingGateMountCount — they should be independent.
```

### Runtime assertions

```ts
// After transitionToScreen('graph') in B1 path:
if (import.meta.env.DEV) {
  requestAnimationFrame(() => {
    if (document.querySelector('[data-graph-loading-gate="1"]')) {
      console.error('[B1Guard] GraphLoadingGate should NOT be mounted during B1 restore');
    }
  });
}
```

---

## 9. Extensibility Notes

### The `ContentFadeOverlay` as a bedrock primitive

This component is intentionally minimal and generic:
- **No gate semantics** — no phase machine, no confirm, no error handling
- **No sidebar coupling** — purely visual, mounting location guarantees isolation
- **Configurable timing** — `fadeMs` and `fadeEasing` props
- **Reusable callbacks** — `onFadeOutComplete`, `onFadeInComplete`

Future uses:
- Any lightweight transition between screens that doesn't need a loading surface
- Graph-to-graph transitions (e.g., switching between saved interfaces while already on graph screen)
- Any "black dip" navigation pattern where you want to hide a swap

### What NOT to do

- **Do not add sidebar freeze/dim/collapse to this component.** If a future use case needs sidebar effects, it should use the gate path, not bolt sidebar logic onto the fade overlay.
- **Do not add loading text or progress indicators.** This is a cosmetic dip, not a loading surface. If loading state matters, use `GraphLoadingGate`.
- **Do not use z-index ≥ 50.** This would cross the sidebar boundary and violate the layering contract.
