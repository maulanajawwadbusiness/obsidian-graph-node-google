# Report: 2026-02-15 Avatar Collapsed-Center Pin Refactor

## 1. Goal

Make avatar photo icon move exactly 0px during sidebar expand/collapse by removing invalid collapsed geometry and pinning avatar icon to a fixed in-bounds anchor.

## 2. Confirmed Root Cause

The previous avatar fix still allowed movement because collapsed geometry remained invalid:

1. `ICON_OFFSET_LEFT` is negative, making some padding expressions negative.
2. CSS ignores negative padding values.
3. Sidebar root keeps `overflow: hidden`, so avatar icon stayed partially clipped in collapsed mode.
4. During expand, clipping released and produced perceived icon movement.

## 3. Implementation

### 3.1 Removed invalid padding dependence from bottom geometry

In `src/components/Sidebar.tsx`:
- Bottom section local style now forces valid horizontal padding:
  - `paddingLeft: '0px'`
  - `paddingRight: '0px'`
- This removes avatar placement dependence on negative padding math.

### 3.2 Introduced fixed avatar pin-lane tokens

Added tokens:
- `AVATAR_PIN_INSET_LEFT_PX = 1`
- `AVATAR_CONTENT_GAP_PX = 12`
- `AVATAR_CONTENT_LANE_OFFSET_PX = AVATAR_PIN_INSET_LEFT_PX + AVATAR_ICON_HITBOX_PX + AVATAR_CONTENT_GAP_PX`

Purpose:
- define explicit fixed icon anchor and separate content-lane offset.

### 3.3 Rebuilt avatar row as pinned icon + independent content lane

In `src/components/Sidebar.tsx`:
- Avatar icon button now uses `AVATAR_ICON_PIN_STYLE`:
  - `position: absolute`
  - fixed `left` inset
  - vertical centering via `top: 50%` + `translateY(-50%)`
- Profile row foundation changed to local anchor container:
  - `position: relative`
  - `display: block`
  - `overflow: hidden`
- Avatar name now renders in a separate content lane:
  - lane width uses `calc(100% - AVATAR_CONTENT_LANE_OFFSET_PX)`
  - lane starts after fixed icon lane via margin-left offset
  - existing phase reveal preserved (`avatarNameRevealStyle`)

Effect:
- avatar icon anchor is now independent from sidebar width interpolation and text lane behavior.

## 4. Invariants Preserved

- Pointer and wheel shielding on avatar row/button remain unchanged.
- Avatar menu trigger path remains unchanged (`data-avatar-trigger` + row click).
- Name reveal still follows shared content transition policy.
- Sidebar root `overflow: hidden` remains intact.

## 5. Verification

Static check run:
- `npx tsc --noEmit --pretty false`

Result:
- same pre-existing backend blocker remains:
  - `src/server/src/server/bootstrap.ts(110,5)`
- no new sidebar-specific type blocker observed before that error.

Manual checks to validate in UI:
1. Collapsed -> expanded slow transition: avatar icon center should remain fixed.
2. Rapid toggle stress: no clip-release drift.
3. Avatar menu open/close behavior remains stable.
4. Long avatar name still truncates in content lane.

## 6. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_avatar_collapsed_center_pin_refactor.md`
