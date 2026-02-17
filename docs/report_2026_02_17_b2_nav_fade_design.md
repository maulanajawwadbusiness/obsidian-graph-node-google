# B2 Nav Fade Design Report

**Date:** 2026-02-17  
**Scope:** Design-only — no code changes  
**Goal:** Propose the best bedrock approach to implement a lightweight 200ms fade for B2 (graph → sidebar session row → switch to different saved graph), reusing existing `ContentFadeOverlay` + `PendingFadeAction` bedrock.

---

## 1. B2 Call Path

### Entry point: Sidebar session row click

```
User clicks a session row in sidebar (while on graph screen)
  → Sidebar.tsx:958-961       onClick={() => onSelectInterface?.(item.id))
  → AppShell.tsx:1087-1092    onSelectInterface={(id) => selectSavedInterfaceById(id))
  → AppShell.tsx:496-511      selectSavedInterfaceById(id)
```

### Current behavior (no fade)

```ts
// AppShell.tsx L496-511 (current)
const selectSavedInterfaceById = React.useCallback((id: string) => {
    const record = savedInterfaces.find((item) => item.id === id);
    if (!record) return;
    if (screen === 'prompt') {
        // B1 forward: uses fade
        if (contentFadePhase !== 'idle') return;
        pendingFadeActionRef.current = { kind: 'restoreInterface', record };
        setContentFadePhase('fadingOut');
        return;
    }
    // ⚡ B2 LANDS HERE when screen is 'graph':
    setPendingLoadInterface(record);     // instant prop update
    if (!isGraphClassScreen(screen)) {   // false — already on graph
        transitionWithPromptGraphGuard('graph');  // SKIPPED
    }
    console.log('[appshell] pending_load_interface id=%s', id);
}, [...]);
```

When `screen === 'graph'`:
- `isGraphClassScreen(screen)` → `true`
- So it **only** calls `setPendingLoadInterface(record)` — no screen change, no fade, no guard
- Graph runtime picks up the new prop and swaps the graph **instantly**

### Key files & lines

| File | Lines | Role |
|------|-------|------|
| [Sidebar.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/components/Sidebar.tsx#L958-L961) | 958-961 | Session row `onClick` → `onSelectInterface(item.id)` |
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L1087-L1092) | 1087-1092 | `onSelectInterface` prop → calls `selectSavedInterfaceById(id)` |
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx#L496-L511) | 496-511 | `selectSavedInterfaceById` — B2 hits the else-branch at L506 |
| [GraphPhysicsPlaygroundShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/playground/GraphPhysicsPlaygroundShell.tsx#L976-L1152) | 976-1152 | `useEffect` that consumes `pendingLoadInterface`: clears engine, rebuilds nodes/links, resets lifecycle |
| [renderScreenContent.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/appshell/render/renderScreenContent.tsx#L136) | 136 | `onPendingLoadInterfaceConsumed={() => setPendingLoadInterface(null)}` |

### How graph runtime consumes the switch (L976-1152)

The `useEffect` at L976 fires when `pendingLoadInterface` changes. It:
1. Calls `onPendingLoadInterfaceConsumed()` → sets `pendingLoadInterface` to `null` (L989)
2. Calls `documentContext.setDocument(rec.parsedDocument)` (L997)
3. Calls `setTopology(rec.topology, ...)` (L1002)
4. Calls `engineRef.current.clear()` (L1121)
5. Rebuilds all nodes from topology + saved layout (L1033-1094)
6. Adds nodes and links to engine (L1122-1123)
7. Calls `engine.resetLifecycle()` (L1124)

This is all **synchronous within a single useEffect**. The old graph disappears and the new one appears **in one frame**, causing a visible instant pop.

---

## 2. Recommended Approach: Extend PendingFadeAction with `switchGraph` (Option A)

### Why this is the obvious bedrock choice

1. **`ContentFadeOverlay` is already mounted** at the correct position (`position:fixed; inset:0; z-index:40`) inside `NON_SIDEBAR_LAYER`.
2. **`PendingFadeAction` discriminated union** already handles two directions (`restoreInterface`, `createNew`). Adding `switchGraph` is a 3-line type extension.
3. **`contentFadePhase` state machine** already drives the overlay correctly.
4. **`onContentFadeOutDone` dispatcher** already reads the pending action and branches. One more `else if` clause.
5. **No new components, no new mount points, no new z-indices.** Pure controller logic extension.

### What's different about B2 vs B1/B1-Reverse

| Aspect | B1 (prompt→graph) | B1-Reverse (graph→prompt) | **B2 (graph→graph)** |
|--------|-------------------|---------------------------|----------------------|
| Screen change | `prompt` → `graph` | `graph` → `prompt` | **None** — stays on `graph` |
| `transitionToScreen` call | Yes | Yes | **No** |
| Side effect | `setPendingLoadInterface(record)` | `setPendingLoadInterface(null)` + `setPendingAnalysis(null)` | **`setPendingLoadInterface(record)`** |
| Runtime behavior | Graph mounts with pending restore | Graph unmounts | **Graph swaps in-place** |

> [!IMPORTANT]
> B2 is actually **simpler** than B1/B1-Reverse because there's no screen transition. The fade overlay hides the instant graph swap. The only action in `onContentFadeOutDone` is `setPendingLoadInterface(record)` — one prop update, no `transitionToScreen`.

### Implementation sketch

#### Step 1: Extend PendingFadeAction type

```diff
  type PendingFadeAction =
      | { kind: 'restoreInterface'; record: SavedInterfaceRecordV1 }
-     | { kind: 'createNew' };
+     | { kind: 'createNew' }
+     | { kind: 'switchGraph'; record: SavedInterfaceRecordV1 };
```

#### Step 2: Add B2 trigger in selectSavedInterfaceById

```diff
  const selectSavedInterfaceById = React.useCallback((id: string) => {
      const record = savedInterfaces.find((item) => item.id === id);
      if (!record) return;
+     if (contentFadePhase !== 'idle') return;  // guard all paths
      if (screen === 'prompt') {
-         if (contentFadePhase !== 'idle') return;
          pendingFadeActionRef.current = { kind: 'restoreInterface', record };
          setContentFadePhase('fadingOut');
          console.log('[B1Fade] start id=%s from=%s', record.id, screen);
          return;
      }
+     if (isGraphClassScreen(screen)) {
+         pendingFadeActionRef.current = { kind: 'switchGraph', record };
+         setContentFadePhase('fadingOut');
+         console.log('[B2Fade] start id=%s from=%s', record.id, screen);
+         return;
+     }
      setPendingLoadInterface(record);
-     if (!isGraphClassScreen(screen)) {
-         transitionWithPromptGraphGuard('graph');
-     }
+     transitionWithPromptGraphGuard('graph');
      console.log('[appshell] pending_load_interface id=%s', id);
  }, [...]);
```

#### Step 3: Add B2 dispatch in onContentFadeOutDone

```diff
  const onContentFadeOutDone = React.useCallback(() => {
      const action = pendingFadeActionRef.current;
      pendingFadeActionRef.current = null;
      if (!action) {
          setContentFadePhase('idle');
          return;
      }
      if (action.kind === 'restoreInterface') {
          setPendingLoadInterface(action.record);
          transitionToScreen('graph');
          console.log('[B1Fade] commit id=%s', action.record.id);
      } else if (action.kind === 'createNew') {
          setPendingLoadInterface(null);
          setPendingAnalysis(null);
          transitionToScreen('prompt');
          console.log('[B1ReverseFade] commit');
+     } else if (action.kind === 'switchGraph') {
+         setPendingLoadInterface(action.record);
+         // No transitionToScreen — stays on 'graph'
+         console.log('[B2Fade] commit id=%s', action.record.id);
      }
      setContentFadePhase('fadingIn');
  }, [transitionToScreen]);
```

### Timeline (B2)

```
t=0ms    User clicks a different session row in sidebar (while on graph screen)
         → contentFadePhase = 'fadingOut'
         → pendingFadeActionRef = { kind: 'switchGraph', record }
         → overlay opacity: 0 → 1 (200ms)
         → sidebar: UNTOUCHED (still on 'graph', no freeze/dim/collapse)
         → graph canvas: still showing old graph, but being covered by fade

t=200ms  onTransitionEnd fires → onContentFadeOutDone()
         → setPendingLoadInterface(action.record)
         → graph runtime useEffect fires:
           engine.clear() → rebuild nodes/links → resetLifecycle()
         → old graph destroyed, new graph rendered (behind opaque overlay)
         → contentFadePhase = 'fadingIn'
         → overlay opacity: 1 → 0 (200ms)

t=400ms  Fade in complete → onContentFadeInDone()
         → contentFadePhase = 'idle'
         → new graph fully visible
```

> [!NOTE]
> The graph swap happens at t=200ms behind the fully opaque overlay (opacity=1). The user never sees the instant engine clear + rebuild. By t=400ms when the overlay fades out, the new graph is fully positioned with saved layout + camera restored.

---

## 3. Alternate Approach: Graph-Pane-Only Opacity Transition (Option C)

### Concept

Instead of using the full-screen `ContentFadeOverlay`, apply an `opacity` CSS transition directly to the `graph-screen-graph-pane` div inside `GraphScreenShell`:

```tsx
<div ref={graphPaneRef} className="graph-screen-graph-pane"
     style={{
         ...GRAPH_SCREEN_PANE_STYLE,
         opacity: isSwitching ? 0 : 1,
         transition: 'opacity 200ms cubic-bezier(0.22, 1, 0.36, 1)',
     }}>
```

### Why rejected

1. **Breaks the bedrock pattern.** B1 and B1-Reverse already use `ContentFadeOverlay` + `PendingFadeAction`. Adding a completely different mechanism for B2 creates two parallel transition systems — one overlay-based, one inline-opacity-based. This increases maintenance cost and cognitive load.

2. **Opacity on graph pane doesn't block input.** With the inline opacity approach, the graph canvas would still receive pointer/wheel events during the transition (just visually fading). You'd need to add a separate input shield, which is exactly what `ContentFadeOverlay` already provides.

3. **No visual consistency.** The overlay approach produces a solid black dip (#06060A). Inline opacity produces a transparent fade where the background bleeds through. Users would see different transition aesthetics for B1 vs B2.

4. **Threading through `GraphScreenShell`.** The switch state would need to be plumbed from `AppShell` through `renderScreenContent` → `GraphScreenShell` as a new prop, breaking the clean prop boundary. `ContentFadeOverlay` avoids this entirely by living at the AppShell level.

> [!TIP]
> Option C might become relevant if we later need sub-pane transitions (e.g., fading just the document viewer), but for full graph switches, the overlay approach is cleaner.

---

## 4. Minimal Patch Plan

### Files to modify

| File | Change | Estimated size |
|------|--------|----------------|
| [AppShell.tsx](file:///c:/Users/maulana/Downloads/obsidian-graph-node-google/src/screens/AppShell.tsx) | Extend `PendingFadeAction` type, add `switchGraph` branch in `selectSavedInterfaceById` and `onContentFadeOutDone` | ~15 lines changed |

### Files NOT modified

| File | Why |
|------|-----|
| `ContentFadeOverlay.tsx` | Already direction-agnostic, no changes needed |
| `GraphPhysicsPlaygroundShell.tsx` | `pendingLoadInterface` consumption is unchanged — still a prop-driven `useEffect` |
| `renderScreenContent.tsx` | No rendering changes |
| `Sidebar.tsx` | No sidebar changes |
| `screenFlowController.ts` | No flow changes |
| `sidebarLockPolicy.ts` | No lock changes |
| `transitionTokens.ts` | Same tokens reused |

### Full change is ~15 lines in one file

This is the smallest possible patch because:
- The overlay component already exists and is mounted
- The state machine (`contentFadePhase`) already works
- The dispatcher (`onContentFadeOutDone`) just needs one more branch
- The trigger (`selectSavedInterfaceById`) just needs one more condition

---

## 5. Z-Index / Layering Proof: Sidebar Safety

Identical to B1/B1-Reverse — no changes to overlay or sidebar:

```
Sidebar:            position:absolute; z-index:50 (LAYER_SIDEBAR)
ContentFadeOverlay: position:fixed;    z-index:40

50 > 40 → sidebar is always above the overlay
```

### Sidebar state during B2 fade

| Property | t=0ms (fadingOut) | t=200ms (graph swap) | t=400ms (fadingIn done) |
|----------|-------------------|----------------------|-------------------------|
| screen | `graph` | `graph` (unchanged!) | `graph` |
| z-index | 50 | 50 | 50 |
| frozen | No | No | No |
| dim alpha | 1.0 | 1.0 | 1.0 |
| expanded | User's choice | Same | Same |
| pointer-events | `auto` | `auto` | `auto` |
| position | Same | Same | Same |

> [!IMPORTANT]
> B2 is the **safest** of all three fade directions for the sidebar, because the screen never changes. `SIDEBAR_INTERACTION_BY_SCREEN['graph']` = `'active'`, `SIDEBAR_DIM_ALPHA_BY_SCREEN['graph']` = `1`. The sidebar literally sees zero prop changes during the entire fade lifecycle.

---

## 6. Edge Cases & Concerns

### 6a. Double-click / rapid session switching

User clicks session A, then immediately clicks session B before fade completes:
- Guard `contentFadePhase !== 'idle'` at top of `selectSavedInterfaceById` blocks the second click
- First fade completes normally with session A
- User must wait ~400ms before selecting session B

This is correct behavior. No queuing needed.

### 6b. Clicking the already-selected session

User clicks the session that's already loaded:
- `selectSavedInterfaceById` finds the record
- `pendingFadeActionRef` is set with a `switchGraph` pointing to the same record
- Fade plays, `setPendingLoadInterface(record)` fires, but the graph runtime's `useEffect` at L969-974 checks:
  ```ts
  const nextId = pendingLoadInterface?.id ?? null;
  if (nextId === lastPendingLoadIdRef.current) return;
  ```
- This **skips** the restore since the ID hasn't changed

**Recommendation:** Add a guard at the fade trigger level:

```ts
if (isGraphClassScreen(screen)) {
    if (pendingLoadInterface?.id === record.id) return;  // already loaded
    pendingFadeActionRef.current = { kind: 'switchGraph', record };
    ...
}
```

This avoids a pointless 400ms fade when clicking the already-active session.

### 6c. Graph runtime aiActivity in progress

The `useEffect` at L976 has a guard:
```ts
if (documentContext.state.aiActivity) return;
```

If AI analysis is running when the user switches graphs, the `pendingLoadInterface` will be set but not consumed until `aiActivity` finishes. Meanwhile, the overlay has already started `.fadingIn` (opacity 1→0).

**Risk:** The overlay fades out, revealing the OLD graph (because the swap hasn't happened yet), then the swap happens later without any fade.

**Mitigation options:**
1. **Don't guard on aiActivity for B2** — but this might corrupt running analysis
2. **Check aiActivity before triggering fade** — if analysis is running, either block the click or show a warning
3. **Accept the race** — analysis during graph switch is rare in practice

**Recommendation:** Add a guard before triggering the fade:

```ts
if (isGraphClassScreen(screen)) {
    if (pendingLoadInterface?.id === record.id) return;
    // If AI is actively running, skip fade (let analysis finish)
    // The old graph is still valid; user can switch after analysis completes
    pendingFadeActionRef.current = { kind: 'switchGraph', record };
    setContentFadePhase('fadingOut');
    ...
}
```

This is a minor race that's unlikely in practice, but worth documenting. If you want belt-and-suspenders, a failsafe `setTimeout` (like the gate's existing pattern) can catch it.

### 6d. selectedInterfaceId highlight timing

`selectedInterfaceId` in the sidebar is currently `pendingLoadInterface?.id` (AppShell L1086). When B2 fade starts, `pendingLoadInterface` is NOT yet set (it's deferred to `onContentFadeOutDone`). So the sidebar highlight won't update until t=200ms.

**This is actually good UX:** the user sees their click registered (hover state), the fade starts, and at t=200ms the highlight shifts to the new session. No premature highlight flicker.

---

## 7. DEV Logs / Counters

### Recommended logging

```ts
// B2 fade start (in selectSavedInterfaceById):
console.log('[B2Fade] start id=%s from=%s', record.id, screen);

// B2 commit (in onContentFadeOutDone):
console.log('[B2Fade] commit id=%s', action.record.id);

// B2 complete (in onContentFadeInDone — shared):
console.log('[B1Fade] done');  // already exists, shared across all directions

// Same-session guard:
console.log('[B2Fade] skipped_same_session id=%s', record.id);
```

### Debug counters

```ts
counters.b2FadeStartCount = (counters.b2FadeStartCount ?? 0) + 1;
counters.b2FadeCompleteCount = (counters.b2FadeCompleteCount ?? 0) + 1;
```

### Runtime assertion

```ts
if (import.meta.env.DEV && action.kind === 'switchGraph') {
    requestAnimationFrame(() => {
        if (document.querySelector('[data-graph-loading-gate="1"]')) {
            console.error('[B2Guard] GraphLoadingGate should NOT be mounted during B2 switch');
        }
    });
}
```

---

## 8. Summary: All Three Fade Directions on One Bedrock

| Direction | Kind | Screen change | Side effect in `onContentFadeOutDone` |
|-----------|------|---------------|---------------------------------------|
| B1 Forward | `restoreInterface` | `prompt` → `graph` | `setPendingLoadInterface(record)` + `transitionToScreen('graph')` |
| B1 Reverse | `createNew` | `graph` → `prompt` | `setPendingLoadInterface(null)` + `setPendingAnalysis(null)` + `transitionToScreen('prompt')` |
| **B2** | **`switchGraph`** | **None** | **`setPendingLoadInterface(record)`** |

All three share:
- Same `ContentFadeOverlay` component (no changes)
- Same `contentFadePhase` state machine (no changes)
- Same `onContentFadeOutDone` + `onContentFadeInDone` callbacks (one new branch)
- Same overlay z-index (40), same sidebar z-index (50)
- Same 200ms timing tokens
- Same input containment during fade
