# CanvasOverlays Modularization Plan (Target: <450 Lines)

Date: 2026-02-21
Scope: `src/playground/components/CanvasOverlays.tsx`
Current size: 1112 lines
Goal: reduce to under 450 lines with strict concern boundaries and pointer-safe overlay behavior.

## 1. Problem Statement

`CanvasOverlays.tsx` currently mixes multiple unrelated concerns:
- top-left dev controls (debug, theme, sidebar, download)
- top-right toolbar (share + dots trigger)
- dots popup menu placement, lifecycle, and fullscreen action
- debug panel shell (open/close, layout responsiveness)
- large debug HUD body (controls, metrics, forensic blocks, harness, scoreboard)
- tooltip wiring for many controls
- repeated pointer/wheel stop-propagation handlers
- local responsive state and global listeners

This centralization increases regression risk, especially for pointer shielding and overlay lifecycle.

## 2. Non-Negotiable Invariants

Must preserve these contracts:
- overlays are input black holes above graph canvas:
  - stop propagation for pointer and wheel on all interactive overlay elements
  - no leaked clicks/wheel to graph runtime below
- boxed/container portal mode behavior parity:
  - top-right dots/menu suppressed as today
  - debug panel auto-close in boxed mode
- fullscreen action behavior unchanged from dots menu
- existing tooltip content and placement anchors remain intact
- existing dev gating (`SHOW_*` flags, `IS_DEV`, `import.meta.env.DEV`) remains intact
- HUD and diagnostics values/render logic remain unchanged

## 3. Target File Architecture

Create a dedicated module namespace:
- `src/playground/components/canvasOverlays/`

### 3.1 Orchestrator

- `src/playground/components/CanvasOverlays.tsx`
  - composition only
  - wires hooks + passes props to section components
  - target size: 280-420 lines

### 3.2 Shared Types and Constants

- `src/playground/components/canvasOverlays/types.ts`
  - `CanvasOverlaysProps` and shared local types
- `src/playground/components/canvasOverlays/constants.ts`
  - flags, icon sizing, menu sizing, static literals

### 3.3 Shared Primitives

- `src/playground/components/canvasOverlays/primitives/MaskIcon.tsx`
- `src/playground/components/canvasOverlays/primitives/OverlayInputShield.ts`
  - reusable handler props:
  - `onPointerDown`, `onPointerUp`, `onWheelCapture`, `onWheel`, optional `onClick`
- `src/playground/components/canvasOverlays/primitives/styles.ts`
  - shared small style maps for menu rows, icon buttons, panel containers

### 3.4 Hooks (Behavior Ownership)

- `src/playground/components/canvasOverlays/hooks/useNarrowViewport.ts`
  - window resize listener and `<450px` detection
- `src/playground/components/canvasOverlays/hooks/useDotsMenuController.ts`
  - trigger ref, open state, anchored positioning, outside click/escape close, boxed/container guard close
- `src/playground/components/canvasOverlays/hooks/useCanvasOverlayTooltips.ts`
  - central tooltip initialization and exported tooltip bag

### 3.5 UI Components

- `src/playground/components/canvasOverlays/TopLeftDevControls.tsx`
  - debug/theme/sidebar/download controls
- `src/playground/components/canvasOverlays/TopRightGraphToolbar.tsx`
  - share and dots trigger row
- `src/playground/components/canvasOverlays/DotsMenu.tsx`
  - fullscreen row and menu shell
- `src/playground/components/canvasOverlays/DebugPanelShell.tsx`
  - panel frame, header, close/hide controls, 2-column layout wrapper
- `src/playground/components/canvasOverlays/debugHud/`
  - `DebugHudControlsColumn.tsx`
  - `DebugHudMetricsColumn.tsx`
  - `HarnessControls.tsx`
  - `ScoreboardTable.tsx`
  - `DiagnosticsSections.tsx`

## 4. Sharp Concern Boundaries

Ownership rules:
- all window listeners live inside hooks only
- menu placement math lives only in `useDotsMenuController`
- debug HUD rendering is split into presentational subcomponents; no lifecycle logic inside them
- tooltip creation is centralized and passed down as props
- pointer/wheel shield behavior is centralized in `OverlayInputShield`
- `CanvasOverlays.tsx` does not contain long inline JSX blocks

Forbidden patterns:
- duplicated `e.stopPropagation()` blocks scattered across new files
- menu open/close logic duplicated in both toolbar and menu
- mixing HUD metric rendering with listener/timer logic

## 5. Refactor Sequence

Phase 1: Static extraction
1. Move prop/type definitions to `types.ts`.
2. Move flags and numeric constants to `constants.ts`.
3. Keep runtime behavior unchanged.

Phase 2: Primitive extraction
1. Move `MaskIcon` to primitive file.
2. Add `OverlayInputShield` helper and replace repeated shield handlers.
3. Confirm pointer/wheel behavior parity manually after replacement.

Phase 3: Hook extraction
1. Extract `useNarrowViewport`.
2. Extract dots menu lifecycle into `useDotsMenuController`.
3. Extract tooltip setup into `useCanvasOverlayTooltips`.

Phase 4: Toolbar and menu components
1. Extract `TopLeftDevControls`.
2. Extract `TopRightGraphToolbar`.
3. Extract `DotsMenu`.
4. Keep existing gating behavior exactly (`SHOW_TOP_RIGHT_DOTS_ICON`, boxed mode suppression, dev flags).

Phase 5: Debug panel split
1. Extract `DebugPanelShell` with header and layout only.
2. Split HUD content into `debugHud/*` subcomponents by domain:
   - controls toggles
   - marker controls
   - advanced physics toggles
   - metrics/forensics
   - harness and scoreboard
3. Keep data formatting identical to current output.

Phase 6: Orchestrator cleanup
1. Reduce `CanvasOverlays.tsx` to composition and wiring only.
2. Ensure final line count is under 450.

## 6. Line Budget Targets

Budgets:
- `src/playground/components/CanvasOverlays.tsx`: 280-420
- `TopLeftDevControls.tsx`: 120-220
- `TopRightGraphToolbar.tsx`: 100-180
- `DotsMenu.tsx`: 90-160
- `DebugPanelShell.tsx`: 120-220
- `DebugHudMetricsColumn.tsx`: 180-320
- `DiagnosticsSections.tsx`: 180-320
- each hook: 80-220

Constraint:
- avoid creating a new monolith above ~500 lines in the replacement modules.

## 7. Verification Matrix (Manual Required)

Pointer and wheel shielding:
- click/drag on toolbar buttons never triggers graph interactions
- wheel on menus/panel never leaks to canvas
- dots menu open state does not allow pointer leakage

Top-right toolbar:
- share icon hover and tooltip unchanged
- dots menu opens/closes correctly on click, outside click, and `Escape`
- menu repositions correctly on resize and scroll

Fullscreen action:
- menu fullscreen action toggles fullscreen as before
- failure path still logs warning without crash

Boxed/container modes:
- dots controls hidden in container portal mode / boxed runtime
- open menu auto-closes when switching into blocked mode
- debug overlay closes when boxed mode is active

Debug panel:
- panel open/close parity
- narrow viewport layout switches under 450px
- all toggles and sliders update same callbacks
- harness buttons still execute same actions
- scoreboard sort and ratio display unchanged

Tooltip parity:
- all previously covered controls still expose same tooltip text

## 8. Risks and Mitigations

Risk: missing input shield on one extracted button.
Mitigation: enforce shared `OverlayInputShield` usage on every interactive overlay control.

Risk: menu close-order regressions.
Mitigation: single `useDotsMenuController` as source of truth for open/close and listeners.

Risk: HUD value display drift after split.
Mitigation: copy render expressions exactly first, then only relocate.

Risk: boxed/runtime gating regression.
Mitigation: keep gating checks in orchestrator and controller hook with explicit parity checks.

## 9. Definition of Done

Done when:
- `src/playground/components/CanvasOverlays.tsx` is under 450 lines
- behavior parity is confirmed across the verification matrix
- all window listener logic is centralized in hooks
- input shielding is centralized and applied consistently
- this report is committed with the modularization work block

