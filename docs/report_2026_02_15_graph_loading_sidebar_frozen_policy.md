# Graph Loading Sidebar Frozen Policy (2026-02-15)

## Scope
- Step 8 policy: keep sidebar visible during `graph_loading` as visual anchor.
- Sidebar is frozen and dimmed while `graph_loading` is active.
- No changes to gate visuals or analysis internals.

## Files Touched
- `src/screens/AppShell.tsx`
- `src/screens/appshell/sidebar/SidebarLayer.tsx`
- `src/components/Sidebar.tsx`

## Policy Table (Single Source)
In `AppShell`:
- `SIDEBAR_VISIBILITY_BY_SCREEN: Record<AppScreen, boolean>`
- `SIDEBAR_INTERACTION_BY_SCREEN: Record<AppScreen, 'active' | 'frozen'>`
- `SIDEBAR_DIM_ALPHA_BY_SCREEN: Record<AppScreen, number>`

Current mapping:
- `welcome1`: hidden, active, alpha 1
- `welcome2`: hidden, active, alpha 1
- `prompt`: visible, active, alpha 1
- `graph_loading`: visible, frozen, alpha 0.5
- `graph`: visible, active, alpha 1

## Frozen Mechanics
- AppShell derives:
  - `sidebarFrozen`
  - `sidebarDimAlpha`
  - `showPersistentSidebar`
- `sidebarDisabled` now includes `sidebarFrozen`.
- All sidebar action handlers in AppShell no-op when frozen.
- Sidebar root receives frozen mode + dim alpha via `SidebarLayer`.

In `Sidebar` frozen mode:
- visual dim via `opacity` from `dimAlpha`
- root remains mounted and visible
- full-surface frozen shield (`data-sidebar-frozen-shield`) absorbs:
  - pointer down/move/up
  - click
  - wheel (preventDefault + stopPropagation)
  - context menu
- root uses `inert` while frozen and blurs focused element inside sidebar.
- root keydown capture blocks keyboard interaction while frozen.

## DEV Guardrails
In `AppShell`:
- Invariant warning if `screen === 'graph_loading'` and `sidebarFrozen !== true`.
- Action warnings when sidebar handlers are invoked during frozen mode:
  - `[SidebarFreezeGuard] blocked_action=...`

## Verification Checklist
- During `graph_loading`, sidebar remains visible and dimmed near 50%.
- Sidebar does not react to click/wheel/hover/focus while frozen.
- Sidebar expand/collapse state does not change while frozen.
- Sidebar-triggered actions do not execute while frozen.
- Confirm -> `graph` restores sidebar interactivity immediately.
- Warm-mount invariant remains unchanged (`?debugWarmMount=1` mount id stability).
- `npm run build` passed after each run.
