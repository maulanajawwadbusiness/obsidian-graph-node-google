# Report: 2026-02-15 Avatar Photo Zero-Move Bolt Follow-Up

## 1. Goal

Complete the icon bolt objective for avatar photo icon so it moves 0 during sidebar expand/collapse.

## 2. Problem After Previous Bolt Pass

Even after removing rail transform drift and row interpolation, avatar photo still appeared to move.

Root cause:
- In collapsed sidebar width, bottom section inner content width was smaller than avatar trigger hitbox width.
- Avatar icon was partially clipped in collapsed state.
- During expand, clipping was released, creating a perceived icon movement.

## 3. Implementation

### 3.1 Collapsed geometry guard for avatar hitbox

In `src/components/Sidebar.tsx`:
- Imported `SIDEBAR_COLLAPSED_WIDTH_PX`.
- Added explicit hitbox constant: `AVATAR_ICON_HITBOX_PX = 32`.
- Adjusted bottom section right padding formula to guarantee collapsed inner width can fully contain avatar hitbox:

`paddingRight = SIDEBAR_COLLAPSED_WIDTH_PX - AVATAR_ICON_HITBOX_PX - (8 - ICON_OFFSET_LEFT)`

This keeps left anchor constant while preventing collapsed-state clipping on avatar icon.

### 3.2 Avatar trigger button width/height bound to hitbox token

In `src/components/Sidebar.tsx`:
- Replaced hardcoded `32px` avatar trigger size with `AVATAR_ICON_HITBOX_PX` tokenized width/height.

Effect:
- Geometry guarantee and rendered hitbox stay in sync.

## 4. Why This Fix Works

- Avatar icon no longer transitions from clipped to unclipped state as sidebar expands.
- With clipping removed and anchor already fixed, perceived icon movement resolves.
- This directly addresses the remaining non-zero movement source for avatar photo.

## 5. Verification

Static check run:
- `npx tsc --noEmit --pretty false`

Result:
- same pre-existing backend blocker:
  - `src/server/src/server/bootstrap.ts(110,5)`
  - Midtrans request type mismatch
- no new sidebar-specific blocker surfaced.

Manual validation to run:
1. Observe avatar icon at collapsed state then expand slowly; icon center should remain visually fixed.
2. Rapid toggle stress for repeated collapse/expand.
3. Confirm avatar menu trigger still works.

## 6. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_avatar_photo_zero_move_bolt_followup.md`
