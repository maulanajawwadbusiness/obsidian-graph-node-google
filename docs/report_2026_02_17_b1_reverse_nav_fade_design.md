# B1-Reverse Nav Fade Design Report

**Date:** 2026-02-17  
**Scope:** Design-only — no code changes  
**Goal:** Propose the best bedrock approach to implement a lightweight 200ms fade for B1-Reverse (graph → sidebar "Create New" → prompt), reusing the existing `ContentFadeOverlay` bedrock from B1 forward.

---

## 1. Codepoints for Graph → Prompt Navigation

### Create New handler (primary B1-Reverse entry point)

| File | Lines | Code |
|------|-------|------|
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1022-L1030) | 1022-1030 | `onCreateNew` callback passed to `SidebarLayer` |

```ts
// Current implementation (no fade):
onCreateNew={() => {
    if (sidebarFrozenActive) {
        warnFrozenSidebarAction('create_new');
        return;
    }
    setPendingLoadInterface(null);      // clear any loaded interface
    setPendingAnalysis(null);           // clear any pending analysis
    transitionToScreen(getCreateNewTarget());  // → 'prompt'
}}
```

### Target resolver

| File | Lines | Code |
|------|-------|------|
| [screenFlowController.ts](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/screenFlow/screenFlowController.ts#L29-L31) | 29-31 | `getCreateNewTarget()` → returns `'prompt'` |

### Other graph → prompt paths (none exist)

| Path | Exists? | Notes |
|------|---------|-------|
| `getBackScreen('graph')` | **Returns `null`** | No back-nav from graph (L21) |
| Search overlay result → prompt | **No** | Search `selectSearchResultById` (L882-884) calls `selectSavedInterfaceById`, which transitions to `graph`, not prompt |
| Any other handler | **None found** | Create New is the only sidebar action that goes graph → prompt |

> [!NOTE]
> B1-Reverse has exactly **one** entry point: the Create New icon handler. This makes the implementation clean — only one callsite needs modification.

---

## 2. Existing B1 Forward Fade Infrastructure

### Already implemented (commit b732f3b)

| Component | File | Role |
|-----------|------|------|
| `ContentFadeOverlay` | [ContentFadeOverlay.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/ContentFadeOverlay.tsx) | Presentational overlay: `position:fixed; inset:0; z-index:40; background:#06060A` |
| `contentFadePhase` state | [AppShell.tsx:151](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L151) | `'idle' \| 'fadingOut' \| 'fadingIn'` |
| B1 forward trigger | [AppShell.tsx:496-500](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L496-L500) | `selectSavedInterfaceById` → checks `screen === 'prompt'` → stores record in ref → triggers `fadingOut` |
| `onContentFadeOutDone` | [AppShell.tsx:508-519](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L508-L519) | Reads pending ref → `setPendingLoadInterface` → `transitionToScreen('graph')` → `fadingIn` |
| `onContentFadeInDone` | [AppShell.tsx:520-523](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L520-L523) | Sets phase to `idle` |
| JSX mount | [AppShell.tsx:1096-1102](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1096-L1102) | Inside `NON_SIDEBAR_LAYER` div, after `{moneyUi}` |

### Key pattern

B1 forward uses a **pending ref** to defer the actual screen transition until after the fade-out completes. The overlay is direction-agnostic — it just fades opacity 0→1 (fadingOut) then 1→0 (fadingIn). The *direction* is entirely determined by what `onContentFadeOutDone` does.

---

## 3. Recommended Approach: Reuse ContentFadeOverlay with Generalized Controller (Option A)

### Why this is the obvious choice

1. **The overlay component is already direction-agnostic.** `ContentFadeOverlay` doesn't know about prompt, graph, or restore. It just transitions opacity based on `phase`.
2. **The state machine is already in AppShell.** `contentFadePhase`, `setContentFadePhase`, `onContentFadeOutDone`, `onContentFadeInDone` are all already wired.
3. **Zero new components needed.** Only the controller logic in AppShell needs a small extension.
4. **No new z-index, position, or DOM changes.** The overlay is already mounted at the right spot.

### What to change

The key insight: `onContentFadeOutDone` currently does one thing — restore a saved interface. For B1-Reverse, it needs to do a different thing — transition to prompt. The cleanest way is to **generalize the pending ref** from a `SavedInterfaceRecordV1` to a discriminated action:

```ts
type PendingFadeAction =
    | { kind: 'restoreInterface'; record: SavedInterfaceRecordV1 }
    | { kind: 'createNew' };
```

### Implementation sketch

#### Step 1: Generalize the pending ref

```diff
-  const pendingRestoreRef = React.useRef<SavedInterfaceRecordV1 | null>(null);
+  const pendingFadeActionRef = React.useRef<PendingFadeAction | null>(null);
```

#### Step 2: Update B1 forward trigger (selectSavedInterfaceById)

```diff
  if (screen === 'prompt') {
-     pendingRestoreRef.current = record;
+     pendingFadeActionRef.current = { kind: 'restoreInterface', record };
      setContentFadePhase('fadingOut');
      console.log('[B1Fade] start id=%s from=%s', record.id, screen);
      return;
  }
```

#### Step 3: Add B1-Reverse trigger (onCreateNew)

```diff
  onCreateNew={() => {
      if (sidebarFrozenActive) {
          warnFrozenSidebarAction('create_new');
          return;
      }
+     if (isGraphClassScreen(screen)) {
+         pendingFadeActionRef.current = { kind: 'createNew' };
+         setContentFadePhase('fadingOut');
+         console.log('[B1ReverseFade] start from=%s', screen);
+         return;
+     }
      setPendingLoadInterface(null);
      setPendingAnalysis(null);
      transitionToScreen(getCreateNewTarget());
  }}
```

#### Step 4: Generalize onContentFadeOutDone

```diff
  const onContentFadeOutDone = React.useCallback(() => {
-     const pendingRestore = pendingRestoreRef.current;
-     pendingRestoreRef.current = null;
-     if (!pendingRestore) {
+     const action = pendingFadeActionRef.current;
+     pendingFadeActionRef.current = null;
+     if (!action) {
          setContentFadePhase('idle');
          return;
      }
-     setPendingLoadInterface(pendingRestore);
-     transitionToScreen('graph');
+     if (action.kind === 'restoreInterface') {
+         setPendingLoadInterface(action.record);
+         transitionToScreen('graph');
+         console.log('[B1Fade] commit id=%s', action.record.id);
+     } else if (action.kind === 'createNew') {
+         setPendingLoadInterface(null);
+         setPendingAnalysis(null);
+         transitionToScreen('prompt');
+         console.log('[B1ReverseFade] commit');
+     }
      setContentFadePhase('fadingIn');
-     console.log('[B1Fade] commit id=%s', pendingRestore.id);
  }, [transitionToScreen]);
```

### Timeline (B1-Reverse)

```
t=0ms    User clicks "Create New" in sidebar (while on graph screen)
         → contentFadePhase = 'fadingOut'
         → pendingFadeActionRef = { kind: 'createNew' }
         → overlay opacity: 0 → 1 (200ms)
         → sidebar: UNTOUCHED (still on 'graph' screen, no freeze/dim)

t=200ms  onTransitionEnd fires → onContentFadeOutDone()
         → setPendingLoadInterface(null)
         → setPendingAnalysis(null)
         → transitionToScreen('prompt')
         → contentFadePhase = 'fadingIn'
         → overlay opacity: 1 → 0 (200ms)
         → screen is now 'prompt', sidebar stays active (SIDEBAR_INTERACTION='active', DIM_ALPHA=1)

t=400ms  Fade in complete → onContentFadeInDone()
         → contentFadePhase = 'idle'
         → prompt screen fully visible, graph runtime unmounted
```

---

## 4. Alternate Approach: New NavFadeController Hook (Option D)

### Concept

Extract all fade controller logic into a `useNavFadeController` hook that manages:
- `contentFadePhase` state
- `pendingFadeAction` ref
- `triggerFade(action)` function
- `onFadeOutDone` / `onFadeInDone` callbacks

### Why rejected (for now)

1. **Premature abstraction.** We have exactly two callers (B1 forward + B1 reverse). The code in `onContentFadeOutDone` is ~15 lines. Extracting a hook now would add indirection without meaningful reuse benefit.
2. **Tight coupling to AppShell state.** The callbacks need access to `setPendingLoadInterface`, `setPendingAnalysis`, `transitionToScreen` — all AppShell-local state. A hook would either need all these as params (verbose) or be co-located anyway.
3. **Easy to extract later.** If a third caller appears, extracting to a hook is a mechanical refactor with zero risk. The discriminated union pattern (`PendingFadeAction`) already provides the extensibility point.

> [!TIP]
> Revisit this if/when a third fade transition direction appears. At that point, the `PendingFadeAction` union would have 3+ variants and a hook would earn its keep.

---

## 5. Minimal Patch Plan

### Files to modify

| File | Change | Size |
|------|--------|------|
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) | Generalize `pendingRestoreRef` → `pendingFadeActionRef`, update `selectSavedInterfaceById`, update `onCreateNew`, update `onContentFadeOutDone` | ~25 lines changed |

### Files NOT modified

| File | Why |
|------|-----|
| `ContentFadeOverlay.tsx` | Already direction-agnostic, no changes needed |
| `screenFlowController.ts` | `getCreateNewTarget()` stays as-is |
| `sidebarLockPolicy.ts` | No sidebar lock changes |
| `Sidebar.tsx` | No sidebar changes |
| `transitionTokens.ts` | Same tokens reused |
| `renderScreenContent.tsx` | No screen content rendering changes |

---

## 6. Z-Index / Layering Proof: Sidebar Safety

The proof is **identical to B1 forward** — no changes to the overlay's DOM position or z-index.

```
Sidebar:            position:absolute; z-index:50 (from SHELL root)
ContentFadeOverlay: position:fixed;    z-index:40 (inside NON_SIDEBAR_LAYER)

50 > 40 → sidebar is always above the overlay
```

### Sidebar state during B1-Reverse fade

| Property | t=0ms (fadingOut starts) | t=200ms (screen swaps to prompt) | t=400ms (fadingIn done) |
|----------|--------------------------|-----------------------------------|-------------------------|
| screen | `graph` | `prompt` | `prompt` |
| z-index | 50 | 50 | 50 |
| frozen | No (`graph` → `active`) | No (`prompt` → `active`) | No |
| dim alpha | 1.0 | 1.0 | 1.0 |
| expanded | User's choice | User's choice (unchanged) | User's choice |
| pointer-events | `auto` | `auto` | `auto` |
| `inert` | false | false | false |
| position | absolute; left:0; top:0; bottom:0 | same | same |

> [!IMPORTANT]
> Neither `graph` nor `prompt` screen triggers sidebar freeze, dim, or collapse. The sidebar sees zero state changes during the entire B1-Reverse fade.

### Overlay input containment (same as B1 forward)

- Overlay: `pointer-events: auto` during fade → blocks clicks/wheel on content area
- Overlay: `onPointerDownCapture`, `onWheelCapture` → `stopPropagation()` prevents leaking to canvas/prompt
- Sidebar: `z-index: 50` above overlay `z-index: 40` → sidebar receives all pointer/wheel events first
- Sidebar: own `onPointerDown/onWheel: stopPropagation()` → events don't leak from sidebar down to overlay

---

## 7. DEV Logs / Counters

### Recommended logging

```ts
// B1-Reverse fade start (in onCreateNew):
console.log('[B1ReverseFade] start from=%s', screen);

// B1-Reverse commit (in onContentFadeOutDone):
console.log('[B1ReverseFade] commit');

// B1-Reverse complete (in onContentFadeInDone — shared with B1 forward):
console.log('[B1Fade] done');  // already exists

// Invariant: should never hit graph_loading from B1-Reverse:
if (import.meta.env.DEV && action.kind === 'createNew') {
    requestAnimationFrame(() => {
        if (document.querySelector('[data-graph-loading-gate="1"]')) {
            console.error('[B1ReverseGuard] GraphLoadingGate should NOT be mounted');
        }
    });
}
```

### Debug counters (window.__arnvoidDebugCounters)

```ts
counters.b1ReverseFadeStartCount = (counters.b1ReverseFadeStartCount ?? 0) + 1;
counters.b1ReverseFadeCompleteCount = (counters.b1ReverseFadeCompleteCount ?? 0) + 1;
```

---

## 8. Edge Cases & Concerns

### 8a. Double-click on "Create New" during fade

If user clicks "Create New" twice rapidly:
- First click: `pendingFadeActionRef.current = { kind: 'createNew' }`, `contentFadePhase = 'fadingOut'`
- Second click: `sidebarFrozenActive` is still false (we're on `graph`, not `graph_loading`), so the guard at L1023 doesn't help.

**Mitigation:** Add a guard at the top of the `onCreateNew` handler:

```ts
if (contentFadePhase !== 'idle') return;  // Fade already in progress
```

This same guard should also be added to `selectSavedInterfaceById` for B1 forward (likely already needed).

### 8b. Graph runtime teardown

When `transitionToScreen('prompt')` is called at t=200ms:
- The screen switches from `graph` to `prompt`
- `renderScreenContent` switches from the `graph_class` branch to the `prompt` branch
- `GraphScreenShell` + `GraphRuntimeLeaseBoundary` unmount
- Graph physics, WebGL context, and runtime tear down

This all happens **behind the opaque overlay** (opacity=1 at t=200ms), so no visual glitch is possible. By t=400ms when the overlay fades out, prompt is fully rendered.

### 8c. Prompt input focus

After the screen swaps to prompt at t=200ms, the prompt input should auto-focus. But the overlay is still visible (opacity transitioning 1→0). This is fine — the overlay will capture events during the 200ms fade-in, then release them. The prompt's own `autoFocus` or focus effect will fire when the component mounts. By the time the overlay fades to opacity=0 and `pointer-events:none`, the prompt is ready for input.

### 8d. Sidebar expansion state preservation

Current behavior on Create New (no fade): sidebar stays wherever the user left it. This doesn't change — we're not touching sidebar state at all during the B1-Reverse fade. If sidebar was expanded, it stays expanded.
