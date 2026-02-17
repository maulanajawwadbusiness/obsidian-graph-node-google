# Report: B1 Nav Fade Run1 (2026-02-17)

## Scope
- Implement B1 only:
  - `prompt -> sidebar/search -> open saved graph -> 200ms content fade -> graph`
- Keep analysis gate behavior unchanged.
- No changes to gate machine policy.

## Files Changed
- `src/screens/appshell/render/ContentFadeOverlay.tsx` (new)
- `src/screens/AppShell.tsx`

## Key Logic
- Added `ContentFadeOverlay` as a content-only fade surface.
  - Full viewport overlay with `background: #06060A`.
  - Fade timing uses:
    - `GRAPH_LOADING_SCREEN_FADE_MS` (200)
    - `GRAPH_LOADING_SCREEN_FADE_EASING`
  - Input ownership while active:
    - `pointerEvents: auto`
    - capture handlers on pointer and wheel run `preventDefault` and `stopPropagation`.
  - `transitionend` is filtered to `opacity` and guarded against double fires.

- Added B1 prompt restore path in `AppShell`.
  - In `selectSavedInterfaceById`, when `screen === 'prompt'`:
    - cache selected record in `pendingRestoreRef`
    - start fade out (`contentFadePhase = 'fadingOut'`)
    - log `[B1Fade] start`
  - On fade-out done:
    - move cached record into `pendingLoadInterface`
    - direct `transitionToScreen('graph')` (no `graph_loading`)
    - start fade in (`contentFadePhase = 'fadingIn'`)
    - log `[B1Fade] commit`
  - On fade-in done:
    - set `contentFadePhase = 'idle'`
    - log `[B1Fade] done`

- Added invariant warning:
  - if `screen === 'graph_loading'` and `pendingLoadInterface` exists:
    - warn `[Invariant] restore routed to graph_loading; should be direct graph for b1`

## Layer and Z-Index Proof (Sidebar Unaffected)
- Sidebar layer uses `LAYER_SIDEBAR = 50` in `src/ui/layers.ts`.
- `ContentFadeOverlay` uses `zIndex: 40`.
- Overlay is mounted inside AppShell non-sidebar container (`NON_SIDEBAR_LAYER_STYLE`) as a sibling to main content and onboarding chrome.
- Result:
  - fade covers content only
  - sidebar remains above fade and stays stable
  - no sidebar dim/collapse/move introduced by fade path

## Verification
- Build:
  - `npm run build` passed.

- Repro checklist:
  1. A path:
     - prompt submit (text or file)
     - expect `graph_loading` + confirm gate
     - unchanged
  2. B1 path:
     - prompt, click saved interface in sidebar
     - expect only 200ms content fade, direct graph
     - no `graph_loading`, no confirm gate
  3. B1-search path:
     - prompt, open search, select saved interface
     - expect same direct fade and direct graph
  4. B2 path:
     - graph, switch saved interface from sidebar
     - unchanged
  5. B3 path:
     - graph to prompt transitions
     - unchanged
