# Forensic Report: Saved Interfaces Search Overlay (Sidebar Search Interfaces)

Date: 2026-02-10
Mode: Forensic scan/dissect only (no implementation)

## Scope
Investigate current wiring, ownership, data flow, event safety, and minimal-diff implementation plan for a centered search overlay opened from Sidebar `Search Interfaces`.

No code changes were made.

## 1) Current Wiring and Ownership

### Sidebar render location and missing callback
- `Search Interfaces` nav row is rendered in `src/components/Sidebar.tsx:334` to `src/components/Sidebar.tsx:341`.
- The row currently has no `onClick` handler wired (only hover handlers), unlike `Create New` which calls `onCreateNew`.
  - `Create New` click wiring: `src/components/Sidebar.tsx:323` to `src/components/Sidebar.tsx:331`.
- `SidebarProps` currently has no search callback prop.
  - Props block: `src/components/Sidebar.tsx:64` to `src/components/Sidebar.tsx:76`.

### AppShell owns navigation/screen and restore intent
- `screen` state ownership is in `src/screens/AppShell.tsx:70`.
- `savedInterfaces` state ownership is in `src/screens/AppShell.tsx:72`.
- `pendingLoadInterface` ownership is in `src/screens/AppShell.tsx:73`.
- Sidebar is rendered and fully controlled from AppShell in `src/screens/AppShell.tsx:309` to `src/screens/AppShell.tsx:345`.
- Existing row selection path already does the required restore intent + prompt to graph navigation:
  - `setPendingLoadInterface(record)` in `src/screens/AppShell.tsx:338`.
  - conditional `setScreen('graph')` in `src/screens/AppShell.tsx:339` to `src/screens/AppShell.tsx:341`.

### Clean prop contract recommendation
- Add optional callback on Sidebar:
  - `onOpenSearchInterfaces?: () => void`
- Wire it on Search row `NavItem` click in Sidebar.
- Pass it from AppShell where Sidebar is instantiated.
- Keep state ownership in AppShell (consistent with existing `onCreateNew`, rename/delete/select control path).

## 2) Data Source and Performance ("zap")

### Current data source and ordering
- AppShell already owns in-memory `savedInterfaces` loaded from local storage:
  - load bridge: `refreshSavedInterfaces` in `src/screens/AppShell.tsx:114` to `src/screens/AppShell.tsx:116`.
- Saved list order is newest-first by store rule:
  - comparator in `src/store/savedInterfacesStore.ts:172` to `src/store/savedInterfacesStore.ts:177`.
  - load returns sorted list in `src/store/savedInterfacesStore.ts:245` to `src/store/savedInterfacesStore.ts:264`.

### Recommendation for typing performance
- Filter in-memory `savedInterfaces` (or `sidebarInterfaces`) in AppShell with memoized query normalization.
- Do not call `loadSavedInterfaces()` on each keystroke.
- Refresh source list only on existing refresh points:
  - initial mount and graph-enter refresh in `src/screens/AppShell.tsx:150` to `src/screens/AppShell.tsx:157`.
  - after save/rename/delete paths already present.

This keeps keystroke latency O(n) over memory and avoids sync localStorage reads during typing.

## 3) Overlay Placement and Event Shielding Pattern

### Best placement
- Implement overlay in AppShell, same level as delete confirm modal, so it can sit above graph/screen and share existing shielding style.
- Existing proven modal pattern:
  - backdrop: `src/screens/AppShell.tsx:359` to `src/screens/AppShell.tsx:370`
  - dialog: `src/screens/AppShell.tsx:371` to `src/screens/AppShell.tsx:379`
  - button-level shielding: `src/screens/AppShell.tsx:391` to `src/screens/AppShell.tsx:408`
  - z-index style: `src/screens/AppShell.tsx:434` to `src/screens/AppShell.tsx:443`

### Why strict shielding is required
- Graph substrate captures pointer heavily at its main container:
  - pointer handlers on graph root in `src/playground/GraphPhysicsPlayground.tsx:1306` to `src/playground/GraphPhysicsPlayground.tsx:1314`.
- Overlay must consume pointer/wheel in its bounds to prevent canvas reaction.

### Exact shielding checklist (for search overlay)
- Backdrop:
  - `pointerEvents: 'auto'`
  - `onPointerDown`, `onPointerUp`, `onClick`, `onWheelCapture`, `onWheel` -> stopPropagation
  - close on backdrop click
- Dialog container:
  - `onPointerDown`, `onPointerUp`, `onClick`, `onWheelCapture`, `onWheel` -> stopPropagation
- Input:
  - `onPointerDown`, `onPointerUp`, `onClick`, `onWheelCapture`, `onWheel` -> stopPropagation
- Results scroll container:
  - `onPointerDown`, `onPointerUp`, `onClick`, `onWheelCapture`, `onWheel` -> stopPropagation
- Result rows/buttons:
  - same stopPropagation handlers on pointer and wheel before selection click logic

This mirrors project non-negotiable overlay safety doctrine and existing AppShell modal practice.

## 4) UX Behavior Spec (v1)

### Required behavior mapping
- Open overlay on Sidebar Search icon click.
- Autofocus input on open.
- Live filter by title, case-insensitive, query trimmed.
- Escape closes overlay.
- Click result:
  - close overlay
  - run same AppShell selection path semantics as sidebar row click:
    - `setPendingLoadInterface(record)`
    - if `screen !== 'graph'` then `setScreen('graph')`

### Empty query default choice
Recommendation: show full saved list in current order (newest-first), effectively "recent first".

Justification:
- Store already guarantees recency ordering; no new ranking logic needed.
- Zero query should still feel useful and instant.
- Minimal diff and predictable behavior with current Sidebar list ordering.

### Enter-to-open top result
- Optional for v1.
- Safe if limited to:
  - only when filtered result count > 0
  - ignored during IME composition
  - uses exact same selection path as click
- Risk: can conflict with text input expectations and IME if not guarded.

## 5) Edge Cases Confirmed

### Modal stacking policy
- Current AppShell allows delete modal based on `pendingDeleteId` only (`src/screens/AppShell.tsx:358`).
- Search overlay should not open when delete confirm is open.
- Recommended policy:
  - if `pendingDeleteId` is set, ignore search-open action.
  - if search overlay is open, row delete action should be ignored or search should close first.

### Sidebar disabled behavior
- Sidebar disabled source: `sidebarDisabled = screen === 'graph' && graphIsLoading` in `src/screens/AppShell.tsx:86`.
- Passed to Sidebar via `disabled` prop at `src/screens/AppShell.tsx:318`.
- Sidebar root sets `pointerEvents: none` when disabled in `src/components/Sidebar.tsx:117` to `src/components/Sidebar.tsx:122`.

Conclusion: Search trigger is naturally disabled in this state if wired through Sidebar click.

### StrictMode/listener hygiene
- Existing examples of effect-gated listener add/remove:
  - delete modal escape effect in `src/screens/AppShell.tsx:137` to `src/screens/AppShell.tsx:148`
  - sidebar row-menu outside click effect in `src/components/Sidebar.tsx:202` to `src/components/Sidebar.tsx:240`
- Search overlay keyboard handling should follow same attach-on-open and cleanup-on-close pattern.

## 6) Minimal Diff Plan (No Code Yet)

### Files likely touched
- `src/components/Sidebar.tsx`
  - Add prop: `onOpenSearchInterfaces?: () => void`
  - Wire Search nav `NavItem` `onClick={onOpenSearchInterfaces}`
- `src/screens/AppShell.tsx`
  - Add search overlay state, filter memo, overlay render block, keyboard close, and result selection handler

### Expected new AppShell state
- `isSearchInterfacesOpen: boolean`
- `searchInterfacesQuery: string`
- `searchInputRef` for autofocus

Optional derived values (memo):
- `normalizedSearchInterfacesQuery`
- `filteredSearchInterfaces`

### Tiny result item shape proposal
Use existing mapped sidebar item shape plus original record id link:
- `id`
- `title`
- `updatedAt`
- `nodeCount`
- `linkCount`

Source alignment:
- Sidebar item mapping already provides these in `src/screens/AppShell.tsx:159` to `src/screens/AppShell.tsx:168`.

### Selection handler contract
- Reuse existing logic semantics from `onSelectInterface` in `src/screens/AppShell.tsx:335` to `src/screens/AppShell.tsx:343`.
- Implementation should call the same flow from overlay result click (directly or via shared helper) to avoid divergence.

## 7) Risk Notes

- Main risk is pointer/wheel leakage to graph due to incomplete stopPropagation on overlay children.
- Secondary risk is opening overlay while delete modal is active (dual modal input ambiguity).
- Performance risk is low if filtering stays in-memory and localStorage is not touched per keystroke.

## 8) Acceptance Checklist for Implementation Phase

1. Search row click opens centered overlay from sidebar.
2. Overlay autofocus works reliably.
3. Typing filters instantly without storage reads.
4. Escape closes overlay.
5. Backdrop click closes overlay.
6. Click result restores session and auto-navigates prompt -> graph.
7. No pointer/wheel events leak to graph while overlay is open.
8. Overlay cannot open over delete confirm modal.
9. Search trigger is inactive while sidebar is disabled.
10. StrictMode does not duplicate listeners or produce stale close behavior.

## 9) Step 3 Implementation Notes (2026-02-10)

- Runtime source of truth remains `AppShell.savedInterfaces` and memoized derivations from it.
  - load bridge still centralized at `refreshSavedInterfaces()` in `src/screens/AppShell.tsx`.
  - search overlay consumes only in-memory `savedInterfaces` via `searchIndex` and `filteredSearchResults` memos.
- Sidebar list and overlay both read from AppShell state; no overlay-path localStorage reads were added.
- Overlay placement reuses AppShell modal pattern (fixed backdrop + centered card) with full shielding on:
  - backdrop
  - modal card
  - input
  - results container
  - result rows
- Selection flow is unified through shared `selectSavedInterfaceById` helper in AppShell so restore behavior remains unchanged between sidebar click and search result click.
- Modal stacking policy remains safe:
  - opening search is blocked while delete confirm is active.
  - if delete confirm opens while search is open, search closes.

## 10) Step 4 Centering Verification (2026-02-10)

- Search overlay is AppShell-level centered with fixed backdrop + flex centering.
- Strengthened viewport safety for small screens:
  - card width uses `min(560px, calc(100vw - 32px))`
  - card max-height uses `calc(100vh - 64px)`
  - card uses `overflow: hidden` so content never spills offscreen
- Backdrop now includes explicit padding and border-box sizing to preserve centering margins consistently.
- Results overflow remains internal to modal via `SEARCH_RESULTS_STYLE` scroll container (`overflowY: auto`, `minHeight: 0`, flex growth).
- Shielding contract remains unchanged: pointerdown/up/click/wheel/wheelCapture stopPropagation on backdrop, card, input, results container, and result rows.

## 11) Step 5 Shielding Hardening (2026-02-10)

- Added reusable `hardShieldInput` helper in `AppShell` and applied it to all search overlay interactive surfaces:
  - backdrop
  - modal root
  - input
  - results container
  - each result row
- Added explicit forensic markers:
  - `data-search-backdrop="1"`
  - `data-search-modal="1"`
- Kept backdrop click-close behavior while preserving stopPropagation.
- Input keydown now handles `Escape` locally (stopPropagation + preventDefault + close) in addition to existing capture-safe fallback listener.
- No new global listeners were introduced; no global preventDefault behavior was added.

## 12) Step 6 UX Polish (2026-02-10)

- Removed search-specific global Escape key listener to reduce overlapping close paths.
- Added modal-level Escape handling so close works even when focus is not in input.
- Added minimal header row with subtle title and icon-only close affordance (`x`) to reduce ambiguity without clutter.
- Added small `Recent` section cue when query is empty; no-results state remains calm text only.
- Kept existing selection flow intact: close overlay first, then call unified `selectSavedInterfaceById`.
- Shielding contract remains fully applied through `hardShieldInput` on all interactive surfaces.
