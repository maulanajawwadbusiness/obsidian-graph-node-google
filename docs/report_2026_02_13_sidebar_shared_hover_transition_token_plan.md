# Report: Sidebar Shared Hover Transition Token Plan

Date: 2026-02-13
Scope: Reintroduce a single shared hover-transition token for sidebar blue accent states.

## Goal
Unify sidebar hover motion timing so blue accent transitions are consistent across icons, labels, menu rows, and avatar surfaces.

## Target Token
- `SIDEBAR_HOVER_TRANSITION = '250ms ease'`

## Implementation Scope
- File: `src/components/Sidebar.tsx`
- In scope:
  - Add one shared transition token
  - Route hover transition declarations to that token
- Out of scope:
  - Functional behavior changes
  - Non-sidebar components
  - Physics/render loop changes

## Planned Wiring
1. Add shared token near color/timing constants.
2. Apply token to icon mask transitions in `MaskIcon`:
   - background-color + opacity.
3. Apply token to nav label color transitions in `NAV_LABEL_STYLE`.
4. Apply token to interface row item transitions in `INTERFACE_ITEM_STYLE`:
   - color + background-color.
5. Replace hardcoded durations with token in:
   - `ROW_ELLIPSIS_BUTTON_STYLE` (opacity)
   - `ROW_MENU_ITEM_CONTENT_STYLE` (filter)
   - `ROW_MENU_ITEM_LABEL_STYLE` (color)
   - `AVATAR_MENU_ITEM_CONTENT_STYLE` (filter)
   - `AVATAR_MENU_ITEM_LABEL_STYLE` (color)
   - `PROFILE_ROW_STYLE` (background-color)
6. Confirm no inline hover transition literals in sidebar override token behavior.

## Verification Plan
- Run `npm run build`.
- Manual checks:
  - Hover Create New/Search/More icon+label fades blue over 250ms.
  - Hover interface row title fades to blue over 250ms.
  - Row ellipsis/menu/avatar hover visuals follow same timing.
  - Hover-out uses same 250ms ease timing.

## Acceptance Criteria
- Sidebar hover transitions are controlled by one token value.
- No hardcoded `100ms`/`140ms` hover timing remains in sidebar styles.
- Build passes.
