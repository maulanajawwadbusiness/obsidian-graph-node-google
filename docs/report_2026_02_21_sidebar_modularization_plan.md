# Sidebar Modularization Plan (Target: <450 Lines)

Date: 2026-02-21
Scope: `src/components/Sidebar.tsx`
Goal: reduce to under 450 lines with strict concern ownership and no behavior regressions.

## 1. Current Problem Statement

`src/components/Sidebar.tsx` is currently ~1940 lines and mixes:
- rendering for top nav, interface list, bottom profile, and 3 popup menus
- motion phase state and reduced-motion detection
- rename workflow state machine
- menu placement math and global event lifecycle
- tooltip integration
- style tokens and large inline style object definitions
- low-level pointer and wheel shielding logic repeated across many elements

This creates high change risk and weak locality of behavior.

## 2. Non-Negotiable Invariants

Must preserve these contracts during split:
- panels own input: sidebar and its menus fully shield pointer and wheel from graph canvas
- frozen mode: input is blocked and focus is cleared from sidebar controls
- motion parity: expand/collapse transitions, reduced-motion behavior, and hover reset semantics remain unchanged
- rename flow: enter/escape/outside-click behavior remains identical
- menu behavior: row menu, avatar menu, more menu keep same placement, close rules, and keyboard escape behavior
- visual parity: typography, icon colors, dimensions, and spacing remain unchanged

## 3. Target Architecture (Concern-First)

Create a dedicated module namespace:
- `src/components/sidebar/`

Planned file map:
- `src/components/Sidebar.tsx`
  - orchestration only; wires hooks + section components + menus
  - target: 300-420 lines
- `src/components/sidebar/types.ts`
  - shared types (`SidebarProps`, menu keys, motion phase, interface item)
- `src/components/sidebar/tokens.ts`
  - numeric tokens, colors, icon geometry, static constants
- `src/components/sidebar/styles.ts`
  - exported `React.CSSProperties` style objects
- `src/components/sidebar/inputShield.ts`
  - shared shield handlers (`onPointerDown`, `onWheelCapture`, `onWheel`)
- `src/components/sidebar/useSidebarMotion.ts`
  - reduced-motion detection, motion phase, hover-arm policy for close icon
- `src/components/sidebar/useSidebarMenus.ts`
  - row/avatar/more menu open-close state + placement compute + outside click/escape listeners
- `src/components/sidebar/useRenameFlow.ts`
  - rename state machine and input focus management
- `src/components/sidebar/SidebarTopSection.tsx`
  - logo/toggle + create/search/more actions
- `src/components/sidebar/SidebarInterfacesSection.tsx`
  - interfaces list + rename row + row menu trigger handling
- `src/components/sidebar/SidebarBottomSection.tsx`
  - document button + avatar row
- `src/components/sidebar/menus/RowActionsMenu.tsx`
- `src/components/sidebar/menus/AvatarMenu.tsx`
- `src/components/sidebar/menus/MoreMenu.tsx`
- `src/components/sidebar/primitives/MaskIcon.tsx`
- `src/components/sidebar/primitives/NavItem.tsx`
- `src/components/sidebar/primitives/SidebarTooltipText.tsx`

## 4. Sharp Concern Boundaries

Boundary rules:
- UI section components are pure render + local hover flags only.
- Global listeners (`window.addEventListener`) live only inside hooks (`useSidebarMenus`, `useSidebarMotion`, `useRenameFlow`).
- Placement math lives only in menu hook, never in render components.
- Style constants are data-only; no behavior in `styles.ts`.
- Input shielding is centralized, imported by all interactive overlays and menu surfaces.
- `Sidebar.tsx` owns composition and top-level state wiring only.

Anti-patterns to avoid:
- duplicate close-on-outside logic in multiple components
- repeated inline shield handlers
- duplicating menu placement constants in several files
- putting style objects back into orchestrator

## 5. Refactor Sequence (Low Risk)

Phase 1: Extract static data
1. Move types to `types.ts`.
2. Move tokens/constants to `tokens.ts`.
3. Move style objects to `styles.ts`.
4. Keep behavior unchanged.

Phase 2: Extract primitives
1. Move `MaskIcon`, `NavItem`, and `SidebarTooltipText` to `primitives/`.
2. Keep prop API compatible with current usage.
3. Verify top section behavior unchanged.

Phase 3: Extract behavior hooks
1. Implement `useRenameFlow`.
2. Implement `useSidebarMotion`.
3. Implement `useSidebarMenus`.
4. Add `inputShield.ts` helper and replace repeated inline handlers.
5. Keep exact existing close/escape/focus semantics.

Phase 4: Extract sections + menus
1. Split render body into top/interfaces/bottom sections.
2. Split row/avatar/more popup menus into dedicated files.
3. Keep `Sidebar.tsx` as orchestrator with minimal JSX.

Phase 5: Contract hardening
1. Ensure no behavior drift through manual matrix (section 7).
2. Line-budget check: `Sidebar.tsx` <450.
3. Add short seam report update to `docs/repo_xray.md` if architecture entry changes.

## 6. Line Budget Targets

File budgets:
- `src/components/Sidebar.tsx`: 300-420
- each section component: 120-260
- each menu component: 80-180
- each hook: 120-260
- `tokens.ts` + `styles.ts`: no strict cap, but data-only

Success condition:
- no single file above ~500 in the new sidebar module
- orchestrator remains under 450 lines

## 7. Verification Matrix (Manual Required)

Input and shielding:
- click and wheel on sidebar never leaks to graph
- open row/avatar/more menus and confirm graph does not react underneath
- frozen mode blocks interactions and focus in sidebar

Motion and rendering:
- collapse and expand transition timing unchanged
- reduced motion immediately settles without transition artifacts
- hover states reset correctly during motion phase

Interfaces section:
- select interface works
- row ellipsis only visible under correct hover/open conditions
- rename enter confirms, escape cancels, outside click cancels
- delete action still calls callback with correct id

Bottom/account:
- avatar trigger opens/closes menu
- profile action and logout action callbacks fire
- document viewer button behavior unchanged when enabled

More menu:
- suggestion and blog rows remain disabled with same visual treatment
- external blog open behavior unchanged

Accessibility and keyboard:
- escape closes open menu in all three menu types
- tab/focus behavior unchanged for frozen and non-frozen states

## 8. Risk Register and Mitigations

Risk: pointer leakage after extraction.
Mitigation: central `inputShield` helper and explicit audit of all interactive elements.

Risk: menu close order drift (row vs avatar vs more).
Mitigation: single menu coordinator hook with deterministic close cascade.

Risk: animation flicker regressions.
Mitigation: preserve existing motion-phase logic and debug switches exactly; move logic without rewriting.

Risk: stale refs across split components.
Mitigation: keep refs owned by orchestrator; pass down as explicit props.

## 9. Definition of Done

Done when all are true:
- `src/components/Sidebar.tsx` is under 450 lines
- sidebar behavior is parity-safe against current implementation
- all sidebar concerns have clear ownership and no duplicated global listener logic
- docs include this report and any seam updates needed by repo architecture docs

