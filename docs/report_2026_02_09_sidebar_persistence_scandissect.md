# Sidebar Persistence Scandissect Report

Date: 2026-02-09
Scope: Forensic scan and implementation plan only (no code changes).
Target: Persist EnterPrompt left sidebar across prompt -> loading -> graph while keeping canvas input laws intact.

## 1. Ground Truth Scan

### A) Screen ownership and transitions

Source: `src/screens/AppShell.tsx`

- Screen enum is currently:
  - `type Screen = 'welcome1' | 'welcome2' | 'prompt' | 'graph';` (`src/screens/AppShell.tsx:18`)
- There is no explicit `loading` screen in `AppShell`.
- Persistence flag is off:
  - `PERSIST_SCREEN = false` (`src/screens/AppShell.tsx:28`)
- Graph isolation is implemented in shell branching:
  - Graph is mounted only under `if (screen === 'graph')` (`src/screens/AppShell.tsx:176`).
- Prompt transition today:
  - `EnterPrompt onEnter -> setScreen('graph')` (`src/screens/AppShell.tsx:225`)
  - `EnterPrompt onSkip -> setScreen('graph')` (`src/screens/AppShell.tsx:226`)
- Graph to prompt transition:
  - No shell path found for `setScreen('prompt')` from graph branch.
  - Only `welcome2 -> prompt` uses `setScreen('prompt')` (`src/screens/AppShell.tsx:212`).

#### Where "loading screen" exists in code

- Loading surface is graph-internal, not shell-level:
  - `GraphPhysicsPlayground` returns `<LoadingScreen ... />` when `aiActivity` or `aiErrorMessage` is active (`src/playground/GraphPhysicsPlayground.tsx:874`, `src/playground/GraphPhysicsPlayground.tsx:875`).
- Trigger chain:
  - Prompt submit sets pending payload in `AppShell` (`src/screens/AppShell.tsx:228`, `src/screens/AppShell.tsx:232`).
  - Graph consumes payload in effect (`src/playground/GraphPhysicsPlayground.tsx:579` onward).
  - Analysis path sets loading on via `setAIActivity(true)` in `applyAnalysisToNodes` (`src/document/nodeBinding.ts:53`) and clears in `finally` (`src/document/nodeBinding.ts:165`).

#### Onboarding chrome ownership

`AppShell` owns and conditionally renders:

- Fullscreen button (`src/screens/AppShell.tsx:87`).
- Money overlays: `BalanceBadge`, `ShortageWarning`, `MoneyNoticeStack` (`src/screens/AppShell.tsx:81` to `src/screens/AppShell.tsx:83`).
- Prompt overlay-open gating for fullscreen blocking (`src/screens/AppShell.tsx:62`, `src/screens/AppShell.tsx:69`, `src/screens/AppShell.tsx:90`).

### B) Sidebar today on prompt screen

Sources: `src/screens/EnterPrompt.tsx`, `src/components/Sidebar.tsx`

#### State ownership

- `EnterPrompt` owns expanded/collapsed state:
  - `isSidebarExpanded` in local state (`src/screens/EnterPrompt.tsx:38`).
- `Sidebar` is controlled by props:
  - `isExpanded`, `onToggle` (`src/components/Sidebar.tsx:62` to `src/components/Sidebar.tsx:64`).

#### Sidebar actions that currently exist

In `Sidebar`:

1. Open sidebar via logo click when collapsed:
   - `onClick={!isExpanded ? onToggle : undefined}` (`src/components/Sidebar.tsx:93`)
2. Close sidebar via close icon when expanded:
   - `onClick={onToggle}` (`src/components/Sidebar.tsx:109`)
3. Hover-only visuals for nav and items:
   - `Home`, `Search Interfaces`, `More` are `NavItem` buttons with hover state, no action handlers (`src/components/Sidebar.tsx:124`, `src/components/Sidebar.tsx:134`, `src/components/Sidebar.tsx:144`).
4. Interface list and avatar rows are visual/hover controls only:
   - Interface item buttons have hover color only (`src/components/Sidebar.tsx:159` onward).
   - Avatar button has no click behavior (`src/components/Sidebar.tsx:197` onward).

There is no navigation wiring, no fullscreen action, and no graph action in this sidebar yet.

#### Dependencies around EnterPrompt

- Auth hook read: `useAuth()` (`src/screens/EnterPrompt.tsx:36`).
- Login overlay is feature-disabled now:
  - `LOGIN_OVERLAY_ENABLED = false` (`src/screens/EnterPrompt.tsx:10`)
  - Conditional render exists but off by flag (`src/screens/EnterPrompt.tsx:170`).
- Payment panel optional:
  - `SHOW_ENTERPROMPT_PAYMENT_PANEL` gate (`src/screens/EnterPrompt.tsx:141`).
- Drag and error overlays exist in prompt screen:
  - Drag overlay with `pointerEvents: 'none'` (`src/screens/EnterPrompt.tsx:190` to `src/screens/EnterPrompt.tsx:198`).
  - Error overlay blocks interaction by default (no pointerEvents override) (`src/screens/EnterPrompt.tsx:227`).

#### Pointer shielding status in current Sidebar

- Current `Sidebar` does not add `onPointerDown` stopPropagation at wrapper or button level.
- This is currently safe in prompt because graph canvas is not mounted there.
- It is not inherently safe if this sidebar is reused over a canvas capture surface.

### C) Graph integration constraints (canvas laws)

Source: `src/playground/GraphPhysicsPlayground.tsx`

- Graph main interaction container captures pointer on pointerdown:
  - `onPointerDown={onPointerDown}` (`src/playground/GraphPhysicsPlayground.tsx:890`)
  - `setPointerCapture(...)` inside handler (`src/playground/GraphPhysicsPlayground.tsx:278`)
- Pointer move processing is capture-phase on graph main container:
  - `onPointerMoveCapture={onPointerMove}` (`src/playground/GraphPhysicsPlayground.tsx:892`)

Overlay safety patterns already used on graph:

- Explicit `onPointerDown` stopPropagation on interactive overlays and controls (`src/playground/GraphPhysicsPlayground.tsx:961`, `src/playground/GraphPhysicsPlayground.tsx:969`, `src/playground/GraphPhysicsPlayground.tsx:984`, `src/playground/GraphPhysicsPlayground.tsx:999`).
- `CanvasOverlays` uses shared stopPropagation hooks on mouse/pointer/wheel (`src/playground/components/CanvasOverlays.tsx:19`, `src/playground/components/CanvasOverlays.tsx:140`, `src/playground/components/CanvasOverlays.tsx:141`, `src/playground/components/CanvasOverlays.tsx:199`, `src/playground/components/CanvasOverlays.tsx:200`).
- Graph sidebar-like debug panel exists:
  - `SidebarControls` (`src/playground/GraphPhysicsPlayground.tsx:1020`)
  - It stops wheel propagation at root (`src/playground/components/SidebarControls.tsx:39`).

Conclusion:
- Any persistent sidebar shown on graph must not leak pointer or wheel into graph container.
- Best safety is to keep persistent sidebar outside graph pointer-capture subtree.

### D) Loading behavior and blocking

Sources: `src/playground/GraphPhysicsPlayground.tsx`, `src/screens/LoadingScreen.tsx`, `src/components/AnalysisOverlay.tsx`

- Current loading UI used by graph:
  - `<LoadingScreen errorMessage={...} />` as full component return (`src/playground/GraphPhysicsPlayground.tsx:875`).
- Current loading component:
  - Full-viewport style, centered spinner/text (`src/screens/LoadingScreen.tsx:8` to `src/screens/LoadingScreen.tsx:16`).
  - Keeps existing error surface text path (`src/screens/LoadingScreen.tsx:54`).
- `AnalysisOverlay` exists but is not mounted anywhere:
  - Only definition found (`src/components/AnalysisOverlay.tsx:37`).

Important doc/runtime mismatch:

- `docs/system.md` describes `AnalysisOverlay` as highest layer (`docs/system.md:56`), but runtime loading behavior currently uses `LoadingScreen` return path in graph.

## 2. Current Behavior Map

### What mounts where now

1. `AppShell` renders one major screen branch (`welcome1`, `welcome2`, `prompt`, `graph`).
2. `EnterPrompt` branch mounts sidebar and prompt card.
3. On submit, `AppShell` sets pending payload and immediately moves to `graph`.
4. `GraphPhysicsPlayground` consumes pending payload and toggles document AI activity.
5. During AI activity/error, graph returns `LoadingScreen` instead of canvas scene.

### Why sidebar disappears today

- EnterPrompt sidebar lives inside `EnterPrompt`.
- `EnterPrompt` unmounts when screen switches to `graph`.
- Therefore sidebar is destroyed before loading and graph phases.

## 3. Proposed Layout Plan (Minimal Diff)

Goal: keep one sidebar instance alive across prompt, graph-loading, and graph-ready phases.

### Before

- `AppShell -> EnterPrompt -> Sidebar`
- `AppShell -> GraphPhysicsPlayground -> (maybe LoadingScreen)`

### After (proposed)

- `AppShell` becomes owner of persistent left sidebar for `prompt` and `graph` phases.
- `AppShell` renders:
  - persistent `Sidebar` sibling
  - main content area switching between `EnterPrompt` content and `GraphPhysicsPlayground`
- `EnterPrompt` no longer mounts its own sidebar.

Recommended tree shape:

1. `AppShell`
2. `PersistentSidebarHost` (visible on prompt and graph)
3. `MainContentHost` (prompt or graph branch)

Why this is lowest risk:

- No need to mount sidebar inside graph pointer-capture container.
- Avoids direct collision with graph drag capture.
- Preserves graph isolation guarantee: graph component still only mounted for `screen === 'graph'`.

## 4. Interaction Safety Plan For Graph

### Primary safety strategy

- Keep persistent sidebar outside graph main interaction subtree.
- This avoids pointerdown bubbling into graph `onPointerDown` capture path.

### Sidebar shielding rules to enforce

Even with external host, keep strong guards:

1. Sidebar wrapper: `pointerEvents: 'auto'` when enabled.
2. Sidebar wrapper: `onPointerDown={(e) => e.stopPropagation()}`.
3. Interactive children (buttons/inputs): add `onPointerDown` stopPropagation for defense-in-depth.
4. Sidebar wrapper: `onWheel={(e) => e.stopPropagation()}` to prevent wheel leakage into graph zoom handlers.

Rationale:

- Matches overlay safety doctrine in `docs/system.md:245` to `docs/system.md:249`.
- Prevents accidental regressions if layout nesting changes later.

## 5. Loading Disable Plan

Requirement: sidebar visible during loading but non-interactable.

Evaluated options:

1. Render sidebar always and set sidebar root `pointerEvents: 'none'` while loading.
2. Add transparent blocker layer above sidebar area while loading.

Recommended: option 1.

Reason:

- Smallest diff, least moving parts.
- No extra z-index choreography.
- Guaranteed non-interactable behavior for all sidebar controls.

Loading state source:

- Since there is no `loading` screen enum, use a graph loading substate signal.
- Proposed minimal seam:
  - `GraphPhysicsPlayground` emits loading state to `AppShell` via callback prop.
  - `AppShell` computes `sidebarInteractable`:
    - `true` on prompt
    - `false` on graph loading
    - `true` on graph ready

Keep existing loading error surface:

- Do not replace `LoadingScreen` content or error behavior.
- Reuse `LoadingScreen` exactly as-is.

## 6. Recommended Architecture Notes

- Sidebar expanded state should live in `AppShell` so it survives prompt unmount and graph loading transitions.
- Storage persistence (session/local) is optional for this task; cross-screen persistence does not require browser storage.
- If storage is added later, use a versioned key and keep it scoped to UI state only.

## 7. Files Likely To Change (No Changes Yet)

1. `src/screens/AppShell.tsx`
   - become sidebar layout owner for prompt and graph phases
   - hold sidebar expanded state
   - hold graph-loading-driven sidebar interactivity flag
2. `src/screens/EnterPrompt.tsx`
   - remove local sidebar mount
   - receive sidebar spacing/layout from shell host
3. `src/components/Sidebar.tsx`
   - add optional `disabled` and input-shield hooks for graph safety
4. `src/playground/GraphPhysicsPlayground.tsx`
   - expose loading state callback to shell (minimal prop addition)
5. Optional style touchpoints if layout needs explicit content offset:
   - `src/screens/AppShell.tsx` inline styles or small shared style file

## 8. Manual Verification Checklist

Must pass all items before implementation is considered done:

1. Prompt phase:
   - Expand/collapse sidebar still works.
   - Existing hover visuals still work.
2. Prompt -> graph loading transition:
   - Sidebar remains visible without remount flicker.
   - Sidebar is non-interactable during loading.
3. Graph ready phase:
   - Sidebar becomes interactable again.
   - Expand/collapse state persists from prompt into graph.
4. Canvas safety:
   - Clicking sidebar controls does not start graph drag.
   - Pointerdown on sidebar never triggers canvas capture behavior.
   - Wheel over sidebar does not zoom or pan graph.
5. Loading safety:
   - While loading, sidebar receives no interaction.
   - `LoadingScreen` error text surface remains unchanged and visible when errors occur.
6. Shell overlays:
   - Fullscreen button and money overlays continue to render according to current screen rules.
7. Regression checks:
   - Graph still mounts only under `screen === 'graph'`.
   - EnterPrompt submit and pending analysis handoff behavior remains unchanged.

## 9. Risks and Watchouts

1. Runtime-doc mismatch:
   - Docs mention `AnalysisOverlay` as active highest layer, but runtime uses `LoadingScreen` return path.
2. Naming collision:
   - Onboarding sidebar (`Sidebar`) vs graph debug sidebar (`SidebarControls`).
3. ASCII policy debt:
   - Existing mojibake and non-ASCII artifacts are present in sidebar-related files; avoid adding new non-ASCII content.

## 10. Implementation Readiness

Scan and planning are complete.
No code changes were made in this task.
Ready for "implement now" signal.

