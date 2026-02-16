# Sidebar Icon-Only Disable Dim (2026-02-16)

## Scope
- Fix sidebar disabled visual behavior so the whole sidebar no longer dims.
- Keep lock, freeze, and input-shield behavior unchanged.

## Problem
- Sidebar root applied `opacity: dimAlpha`, which dimmed every child surface.
- In `graph_loading`, this made text and container surfaces too dim.

## Changes
- `src/components/Sidebar.tsx`
  - Removed root-level `opacity: dimAlpha` from sidebar style.
  - Added disabled icon-only multiplier:
    - `iconOpacityMultiplier = disabled ? clamp(dimAlpha, 0, 1) : 1`
    - `applyIconOpacity(baseOpacity)` helper for consistent composition.
  - Applied icon-only opacity to:
    - top logo/toggle icon masks
    - close icon svg opacity
    - nav glyphs (`Create New`, `Search Interfaces`, `More`)
    - document viewer icon
    - row ellipsis and row-menu icons
    - avatar menu icons
    - avatar icon visual (image/fallback)
  - Added runtime marker:
    - `data-sidebar-icon-dim-multiplier`

- `docs/system.md`
  - Updated `graph_loading` sidebar contract to icon-only dim behavior.

- `docs/repo_xray.md`
  - Updated graph loading sidebar note to icon-only dim behavior.

## Invariants Preserved
- `disabled` and `frozen` input ownership semantics are unchanged.
- Sidebar shield/inert behavior remains intact.
- Lock policy and reason codes remain unchanged.

## Verification Checklist
1. In `graph_loading`, sidebar is disabled and only icons/avatar icon render at 0.5 opacity.
2. Text labels and sidebar container remain full opacity.
3. On transition to `graph`, icon opacity returns to full.
4. No pointer/wheel leakage occurs while sidebar is frozen.
