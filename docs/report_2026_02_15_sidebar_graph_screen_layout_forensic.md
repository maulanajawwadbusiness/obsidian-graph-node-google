# Forensic Report: Sidebar as Graph Screen Layout Partner
Date: 2026-02-15
Scope: layout ownership and screen-state integration for Sidebar vs graph surface

## 1. Request Restatement
Goal for later implementation:
- Sidebar must be a real layout part of graph screen, not an overlay sticker.
- Expanding Sidebar should push/reflow graph screen area in a controlled way.
- This should become the base contract for future screen positioning work.

No runtime code changes were made in this pass.

## 2. Files Forensically Scanned
Core requested files:
- docs/system.md
- docs/repo_xray.md
- src/components/Sidebar.tsx

Graph/screen ownership and layout seams:
- src/screens/appshell/screenFlow/screenTypes.ts
- src/screens/appshell/render/renderScreenContent.tsx
- src/screens/AppShell.tsx
- src/screens/appshell/appShellStyles.ts
- src/screens/appshell/sidebar/SidebarLayer.tsx
- src/playground/GraphPhysicsPlaygroundShell.tsx
- src/playground/graphPlaygroundStyles.ts
- src/playground/components/CanvasOverlays.tsx
- src/screens/appshell/transitions/OnboardingLayerHost.tsx

Positioning overlays that may be impacted by future layout refactor:
- src/screens/appshell/overlays/OnboardingChrome.tsx
- src/components/BalanceBadge.tsx
- src/components/ShortageWarning.tsx
- src/components/MoneyNoticeStack.tsx

## 3. Screen-State Map and Graph Location
Canonical app screens:
- src/screens/appshell/screenFlow/screenTypes.ts:1
  - welcome1, welcome2, prompt, graph

Graph mount point in state switch:
- src/screens/appshell/render/renderScreenContent.tsx:60
  - graph branch mounts GraphWithPending in Suspense

AppShell state owner:
- src/screens/AppShell.tsx
  - screen state, pending analysis, saved interfaces, sidebar expanded state
  - graph is rendered via renderScreenContent(...)

Key graph/shell coupling in AppShell:
- src/screens/AppShell.tsx:119
  - Sidebar is shown for prompt and graph (not graph-only)
- src/screens/AppShell.tsx:359
  - SidebarLayer rendered as sibling of main screen layer
- src/screens/AppShell.tsx:391
  - main content is only dimmed when sidebar expands, not repositioned

## 4. Current Layout Topology (Root Cause)
Current high-level tree in AppShell:
1. SidebarLayer (absolute/floating)
2. NON_SIDEBAR_LAYER (full width)
   - main screen root
   - onboarding chrome
   - money UI
3. modal layer

Evidence of overlay behavior:
- src/screens/appshell/appShellStyles.ts:25
  - NON_SIDEBAR_LAYER_STYLE uses width: 100%
- src/screens/appshell/appShellStyles.ts:19
  - MAIN_SCREEN_CONTAINER_STYLE uses width: 100%
- src/components/Sidebar.tsx:1269
  - SIDEBAR base is position: absolute, left: 0, top: 0, bottom: 0
- src/components/Sidebar.tsx:34
  - collapsed width fixed 35px
- src/components/Sidebar.tsx:35
  - expanded width 10vw with min 200px

Conclusion:
- Sidebar does not participate in layout flow width math.
- Graph container stays full width and is only visually dimmed.
- This is exactly why it behaves like a sticker overlay.

## 5. Graph Surface Geometry Dependencies
Graph playground container uses viewport sizing:
- src/playground/graphPlaygroundStyles.ts:15
  - width: 100vw
- src/playground/graphPlaygroundStyles.ts:16
  - height: 100vh

Graph runtime root:
- src/playground/GraphPhysicsPlaygroundShell.tsx:1317
  - root div uses CONTAINER_STYLE

Implication for future push-layout:
- Even if AppShell allocates less horizontal space, graph internals currently target viewport width.
- This can cause mismatch if parent width is no longer full viewport.

## 6. Legacy/Internal Sidebar in Graph Shell
There is a separate debug controls sidebar state inside graph shell:
- src/playground/GraphPhysicsPlaygroundShell.tsx:162
  - sidebarOpen state
- src/playground/GraphPhysicsPlaygroundShell.tsx:1457
  - SidebarControls panel
- src/playground/components/CanvasOverlays.tsx:312
  - controls toggle wiring

This is not the AppShell product Sidebar. It is a legacy/debug control panel.
Potential confusion/risk for future refactor:
- Two different "sidebar" concepts exist.
- Must avoid coupling product layout logic with debug controls toggle path.

## 7. Input Shielding Status (Important Constraints)
Strong pointer/wheel shielding already exists and must be preserved:
- Sidebar root and interactive controls stop pointer/wheel propagation.
- ModalLayer and search/profile/logout/delete overlays use hard shielding.
- Onboarding transition host has full input shield during crossfade.

Relevant docs contract alignment:
- docs/system.md and AGENTS doctrine require panels to fully own input and prevent canvas leaks.

## 8. Additional Positioning Surfaces Affected by Future Graph-Scoped Layout
Several overlays are fixed to viewport edges, not graph container edges:
- src/screens/appshell/overlays/OnboardingChrome.tsx (top-right fixed)
- src/components/BalanceBadge.tsx (top-right fixed)
- src/components/MoneyNoticeStack.tsx (bottom-right fixed)
- src/components/ShortageWarning.tsx (fullscreen fixed)

These are valid today, but if graph becomes a constrained pane, some may feel detached unless deliberately kept viewport-global.

## 9. Sharp Problem Statement
Current architecture makes Sidebar a sibling overlay and keeps graph/main content at full width.
Therefore:
- expanding Sidebar cannot push graph bounds,
- graph positioning logic cannot rely on a single structural layout contract,
- future screen positioning issues accumulate because layout truth is split between overlay and content layers.

## 10. Implementation Direction for Next Pass (No Code Yet)
Recommended seam to introduce in next work block:
1. AppShell-level structural layout contract for graph screen:
   - graph screen wrapper with two panes: sidebar pane + graph pane
   - graph pane width computed from sidebar state
2. Keep prompt/welcome behavior explicit:
   - decide if sidebar remains overlay on prompt or use separate prompt layout policy
3. Replace dim-only behavior with width/transform-aware layout behavior.
4. Normalize graph container sizing:
   - migrate graph root away from hard 100vw assumptions when hosted in constrained pane
5. Preserve all pointer/wheel shielding and overlay z-index contracts.
6. Keep legacy debug SidebarControls isolated from product Sidebar contract.

## 11. Acceptance Targets for the Later Implementation
When implementation starts, success criteria should include:
- expanding/collapsing Sidebar changes graph viewport width predictably
- no canvas pointer/wheel leaks under sidebar or modals
- no onboarding/prompt regressions
- loading screen and graph mount still stable
- no visual jump from mixed viewport-vs-container sizing

## 12. Final Forensic Conclusion
The graph screen currently lives as a full-width surface selected by AppShell screen state, while Sidebar is absolutely positioned as a sibling overlay. The system currently dims content under sidebar expansion but does not structurally reflow graph bounds. Your requested direction is valid and aligns with long-term positioning stability: Sidebar should become a first-class layout partner of the graph screen with explicit pane geometry ownership in AppShell.

## Agent forensic pass - sidebar/graph layout topology (2026-02-15)

### A. Reconciled topology tree (current runtime truth)

```text
AppShell (src/screens/AppShell.tsx)
|- SHELL_STYLE root (relative, width 100%, minHeight 100vh)
|- SidebarLayer (shown on prompt + graph)
|  |- Sidebar (absolute; left 0, top 0, bottom 0; width 35px or 10vw min 200px)
|- NON_SIDEBAR_LAYER (width 100%, minHeight 100vh)
|  |- MAIN_SCREEN_CONTAINER (width 100%, minHeight 100vh)
|  |  |- screenContent from renderScreenContent(...)
|  |     |- graph -> GraphPhysicsPlayground (lazy)
|  |     |- welcome1 / welcome2 / prompt as non-graph screens
|  |- OnboardingChrome (fixed top-right fullscreen button on onboarding screens)
|  |- Money UI mounts (ShortageWarning + MoneyNoticeStack)
|- ModalLayer (profile/logout/delete/search overlays)
```

Key reconciliation notes versus pass 0:
- Pass 0 remains accurate on the main issue: Sidebar is still a sibling overlay, not a structural pane.
- Graph mount path is unchanged: `renderScreenContent` graph branch mounts `GraphWithPending`.
- AppShell still dims non-sidebar content when sidebar expands, but does not alter content bounds.
- No `docs/AGENTS.md` file exists in current tree.

### B. Current layout ownership and conflicts

- Graph screen selection owner:
  - `src/screens/AppShell.tsx`: screen state owner and screenContent orchestrator.
  - `src/screens/appshell/render/renderScreenContent.tsx`: graph branch mounts graph runtime.
- Graph pane owner today (effective):
  - `src/screens/AppShell.tsx` + `src/screens/appshell/appShellStyles.ts` define full-width wrapper (`NON_SIDEBAR_LAYER_STYLE`, `MAIN_SCREEN_CONTAINER_STYLE`).
  - This means graph area ownership is currently "full non-sidebar layer", not a split pane.
- Sidebar mount relative to graph:
  - `SidebarLayer` is rendered before non-sidebar layer as sibling.
  - `Sidebar` is `position: absolute`, width tokenized as collapsed/expanded, with high z layer.
- Visual effect of expansion today:
  - Non-sidebar region gets `filter: brightness(0.8)`.
  - No width/left transform contract for graph screen bounds.

### C. Graph geometry assumptions and touchpoints

Direct viewport-size assumptions (must be revised for structural pane):
- `src/playground/graphPlaygroundStyles.ts`
  - `CONTAINER_STYLE.width = '100vw'`
  - `CONTAINER_STYLE.height = '100vh'`
- `src/playground/components/CanvasOverlays.tsx`
  - fixed-menu max width uses `calc(100vw - ...)`
  - debug panel width uses `calc(100vw - 32px)`
  - debug panel max height uses `calc(100vh - 40px)`
  - viewer offset uses `left: calc(50vw + 16px)`

Full-height wrappers and implied viewport fill:
- `src/screens/appshell/appShellStyles.ts`
  - shell and main wrappers use `minHeight: 100vh`
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`
  - transition container and active layer use `minHeight: 100vh`

Sidebar size tokens relevant to future split-pane math:
- `src/components/Sidebar.tsx`
  - collapsed width `35px`
  - expanded width `10vw`
  - expanded min width `200px`

Fixed-width overlays/panels that will still exist during split-pane:
- `src/playground/graphPlaygroundStyles.ts` `SIDEBAR_STYLE.width = 320px` (legacy debug panel)
- `src/components/ShortageWarning.tsx` `PANEL_STYLE.width = 360px`
- `src/screens/appshell/overlays/ModalLayer.tsx` multiple fixed/max widths (profile/logout/delete/search cards)

### D. Components that assume "graph fills viewport"

Graph-local runtime components with viewport-coupled math:
- `GraphPhysicsPlaygroundShell` root uses `CONTAINER_STYLE` (100vw/100vh).
- `CanvasOverlays` uses viewport terms (`50vw`, `100vw`, `100vh`) for overlay positioning and sizing.
- Dots action menu in `CanvasOverlays` anchors with `window.innerWidth/innerHeight` and fixed positioning.

Viewport-global UI that intentionally pins to window:
- `OnboardingChrome` fullscreen button (`position: fixed`, top-right).
- `BalanceBadge` (`position: fixed`, top-right).
- `MoneyNoticeStack` (`position: fixed`, bottom-right).
- `ShortageWarning` backdrop (`position: fixed`, inset 0).
- `ModalLayer` backdrops/cards (`position: fixed`, screen-centered).

### E. Z-index map and locality classification

Layer constants (`src/ui/layers.ts`):
- `LAYER_SIDEBAR = 50`
- `LAYER_ONBOARDING_FULLSCREEN_BUTTON = 1200`
- `LAYER_SIDEBAR_ROW_MENU = 1400`
- `LAYER_MODAL_SEARCH = 3100`
- `LAYER_MODAL_DELETE = 3200`
- `LAYER_MODAL_PROFILE = 3300`
- `LAYER_MODAL_LOGOUT_CONFIRM = 3400`
- `LAYER_OVERLAY_LOGIN = 5000`

Additional local z usage:
- `CanvasOverlays` top-right icon group `zIndex: 10`
- `CanvasOverlays` dots menu `zIndex: 1200`
- `BalanceBadge` `zIndex: 120`
- `MoneyNoticeStack` `zIndex: 180`
- `ShortageWarning` `zIndex: 200`
- legacy debug overlay style has very high z in playground styles.

Graph-local (should move with graph pane in future split-pane):
- Canvas and graph runtime overlays inside `GraphPhysicsPlaygroundShell`
- `CanvasOverlays` controls and dots menu
- legacy debug controls panel and playground debug HUD
- dot popup portal and rotation compass inside graph runtime

Viewport-global (should remain pinned to viewport):
- AppShell modal layer surfaces
- onboarding fullscreen chrome
- money warning/notice surfaces and balance anchor (unless product decides otherwise)
- login overlay layer

### F. Input shielding map (pointer/wheel)

Current shielding that aligns with doctrine:
- Sidebar surface:
  - `src/components/Sidebar.tsx` root aside stops pointer down and wheel capture/wheel.
  - interactive controls and menus broadly stop pointer/wheel.
- Modal surfaces:
  - `src/screens/appshell/overlays/ModalLayer.tsx` root capture stop + per-backdrop/per-control shielding.
- Onboarding transitions:
  - `src/screens/appshell/transitions/OnboardingLayerHost.tsx` transition shield stops pointer + wheel while crossfading.
- Graph-local overlays:
  - `src/playground/components/CanvasOverlays.tsx` interactive controls stop pointer/wheel.
- Money surfaces:
  - `BalanceBadge` stops pointer down.
  - `MoneyNoticeStack` container/buttons stop pointer down.
  - `ShortageWarning` backdrop/panel/buttons stop pointer down.

Suspicious areas for future split-pane migration:
- `BalanceBadge` and `MoneyNoticeStack` do not stop wheel; currently acceptable due to fixed placement away from canvas in most cases, but with narrower graph pane they may overlap graph-occupied regions more often.
- `Sidebar` uses absolute positioning in AppShell root; once split-pane is introduced, any residual absolute/fixed children may visually appear correct but still bypass intended pane geometry if not re-anchored.
- `CanvasOverlays` viewport math (`50vw`, `100vw`, `100vh`) can place controls outside the future graph pane and into sidebar or modal collision zones.

### G. Recommended seam plan for later implementation (no code in this run)

Primary structural seam in AppShell:
- Add a graph-only layout host in AppShell render path, for example:
  - `GraphScreenLayoutHost` in `src/screens/appshell/layout/`.
  - Contract: two-pane layout `[sidebar pane | graph pane]` when `screen === 'graph'`.
- Keep prompt/welcome explicit:
  - prompt can keep current overlay sidebar behavior or receive a separate prompt-layout host.
  - welcome screens remain no-sidebar by policy.

Proposed interface additions for later run:
- `Sidebar` / `SidebarLayer`:
  - add optional `mode: 'overlay' | 'pane'`.
  - add `paneWidthPx` reporting callback or expose canonical width token resolver from AppShell.
- AppShell layout orchestration:
  - add computed sidebar width state (collapsed/expanded resolved to px).
  - pass graph-pane sizing context to graph screen host.
- Graph runtime:
  - `GraphPhysicsPlaygroundShell` should accept container-truth layout and stop using viewport-sized container style.
  - replace `CONTAINER_STYLE` viewport width/height assumptions with container-relative (`width: 100%`, `height: 100%`, and parent-owned min/max).

Style objects/class areas that need later edits:
- `src/screens/appshell/appShellStyles.ts`
  - add structural graph split styles (wrapper, sidebar pane, graph pane).
- `src/components/Sidebar.tsx`
  - remove absolute root requirement in pane mode; keep overlay mode for non-graph if needed.
- `src/playground/graphPlaygroundStyles.ts`
  - convert `CONTAINER_STYLE` from `100vw/100vh` to container-bound defaults.
- `src/playground/components/CanvasOverlays.tsx`
  - replace viewport formulas (`50vw`, `100vw`, `100vh`) with pane-relative geometry source.

Graph code paths that must treat container size as truth:
- `GraphPhysicsPlaygroundShell` root container + canvas sizing.
- overlay positioning logic in `CanvasOverlays` and any fixed-position graph controls.
- any pointer-to-world calculations relying on full-window assumptions should continue using measured container rect only.

### H. Acceptance criteria for future "sidebar becomes structural" run

Required success criteria:
- Graph screen uses explicit two-pane structure where sidebar width changes graph pane bounds.
- Sidebar expand/collapse updates graph pane width and position structurally, not by dim filter only.
- Graph canvas and graph-local overlays remain inside graph pane bounds across collapsed/expanded states.
- Viewport-global overlays remain correctly pinned and still shield input from canvas.
- Pointer and wheel doctrine is preserved: active top UI blocks canvas interaction underneath.
- Prompt/welcome behavior remains explicit and unchanged unless intentionally redesigned.
- No regression in loading screen, onboarding transitions, and modal stacking order.

Verification checklist for implementation run:
- Collapse/expand sidebar on graph screen and confirm canvas rect changes.
- Confirm dot dragging/picking remains accurate at both pane widths.
- Confirm graph top-right controls do not drift into sidebar area.
- Confirm modal/search/profile/logout input never leaks to canvas.
- Confirm money surfaces behavior is intentional with narrower graph pane (keep viewport-global or convert explicitly).

## Implementation summary - graph sidebar structural layout (2026-02-15)

Note:
- Sections 1-12 and the earlier agent forensic pass capture pass-0 analysis before implementation.
- The following section is the implemented runtime truth after steps 1-6.

### A. Final graph-screen topology

```text
AppShell
|- SidebarLayer (product sidebar overlay, unchanged behavior)
|- NON_SIDEBAR_LAYER
|  |- MAIN_SCREEN_CONTAINER
|  |  |- renderScreenContent(screen='graph')
|  |  |  |- Suspense
|  |  |  |  |- GraphScreenShell(sidebarExpanded=isSidebarExpanded)
|  |  |  |  |  |- graph-screen-layout (flex row)
|  |  |  |  |  |  |- graph-screen-sidebar-pane (structural column)
|  |  |  |  |  |  |- graph-screen-graph-pane (hosts GraphWithPending)
|  |  |- renderScreenContent(other screens)
|  |     |- welcome1 / welcome2 / prompt (no GraphScreenShell)
|- ModalLayer
```

### B. Container-relative graph runtime

- Graph runtime root is container-relative and fills its parent graph pane:
  - `src/playground/graphPlaygroundStyles.ts`
  - `CONTAINER_STYLE.width = '100%'`
  - `CONTAINER_STYLE.height = '100%'`
- Viewport ownership now sits at screen-shell layout level, not inside playground root sizing.

### C. Width binding to shared sidebar state

- Graph structural left column width follows AppShell `isSidebarExpanded`.
- Shared width tokens live in `src/screens/appshell/appShellStyles.ts`:
  - collapsed: `35px`
  - expanded: `10vw`
  - expanded min: `200px`
- Same shared constants are used by product Sidebar width logic in `src/components/Sidebar.tsx`.

### D. Product sidebar vs debug sidebar separation

- Product Sidebar:
  - owner path: `SidebarLayer` -> `Sidebar`
  - state owner: `isSidebarExpanded` in `src/screens/AppShell.tsx`
  - behavior unchanged (overlay on prompt and graph)
- Internal debug sidebar:
  - lives in `src/playground/GraphPhysicsPlaygroundShell.tsx`
  - debug-only controls panel (`DebugSidebarControls`)
  - gated by `enableDebugSidebar` (default true)
  - product graph path passes `enableDebugSidebar={false}` in `renderScreenContent`.

### E. Layering and shielding status

Conceptual stack on graph screen:
1. graph base (`GraphScreenShell` -> graph pane -> graph runtime)
2. graph-local overlays (`CanvasOverlays`, runtime UI)
3. viewport overlays (`OnboardingChrome`, money surfaces)
4. Sidebar overlay (`SidebarLayer` -> `Sidebar`)
5. modal layer (`ModalLayer` search/delete/profile/logout)

Shielding contract status:
- Sidebar and modal surfaces shield pointer + wheel.
- Graph-local interactive overlays shield pointer + wheel.
- Money surfaces include wheel shielding hardening from step 5.
- `GraphScreenShell` wrappers do not add z-index and do not alter overlay ownership.

### F. Remaining follow-up

- Left structural graph column is still empty.
- Future layout run can move product Sidebar into this structural pane and decide graph-screen overlay retirement policy while keeping non-graph screens explicit.
