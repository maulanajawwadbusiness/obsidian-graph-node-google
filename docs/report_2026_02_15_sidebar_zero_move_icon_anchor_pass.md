# Report: 2026-02-15 Sidebar Zero-Move Icon Anchor Pass

## 1. Goal

Bolt sidebar icons to zero movement during expand/collapse.

Targeted icons:
- top logo/toggle icon
- Create icon
- Search icon
- More icon
- Document Viewer icon
- Avatar icon

Intent:
- icons are stability anchors and must not drift in X or Y during sidebar geometry transitions.
- text/labels may still animate, but icon anchors must remain fixed.

## 2. Root Causes Confirmed

1. Rail transform drift:
- `sidebarVisualRailStyle` previously used animated transform helpers.
- This applied subtle horizontal drift to icon-bearing containers.

2. Bottom section layout interpolation drift:
- bottom section paddings previously animated between collapsed and expanded values.
- avatar row width/margin also interpolated.
- this produced larger apparent motion for document/avatar icons.

3. Avatar section centering:
- avatar row container used centered justification, so geometry changes shifted left edge anchor.

## 3. Implementation

### 3.1 Remove rail transform drift from icon containers

In `src/components/Sidebar.tsx`:
- Removed visual rail transform transition usage from sidebar rails.
- Removed related imports:
  - `getSidebarVisualRailTransform`
  - `getSidebarVisualRailTransitionCss`
- Sidebar rail wrappers now render as static layout containers (`display/flex/size` only).

Effect:
- top icon paths no longer inherit transform-based drift.

### 3.2 Freeze bottom section anchor geometry

In `src/components/Sidebar.tsx`:
- Bottom section horizontal paddings now fixed (always expanded values).
- Removed bottom padding transition interpolation.

Effect:
- document viewer and avatar icon anchor baseline no longer shifts with expand state.

### 3.3 Bolt avatar icon row foundation

In `src/components/Sidebar.tsx`:
- Avatar trigger row now uses fixed width foundation (`width: 100%`), not collapsed/expanded width interpolation.
- Removed right margin interpolation.
- Avatar section alignment changed from centered to left anchored:
  - `justifyContent: 'flex-start'`

Effect:
- avatar icon left anchor no longer shifts during sidebar motion.

## 4. Behavioral Notes

- Content label transitions remain active for text lanes.
- Icon movement paths are now decoupled from those text transitions.
- Pointer/wheel shielding contracts were not changed.

## 5. Verification

Static check run:
- `npx tsc --noEmit --pretty false`

Result:
- same pre-existing backend blocker remains:
  - `src/server/src/server/bootstrap.ts(110,5)`
  - Midtrans request type mismatch
- no new sidebar-specific type error appeared before that blocker.

Manual QA to validate in UI:
1. Rapid expand/collapse on graph screen and prompt screen.
2. Observe top icon anchors for zero drift.
3. Observe document viewer and avatar icon anchors for zero drift.
4. Hover and click behavior on icon controls.
5. Avatar menu anchor/open/close behavior.

## 6. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_sidebar_zero_move_icon_anchor_pass.md`
