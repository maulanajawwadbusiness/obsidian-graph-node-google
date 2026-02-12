# Report 2026-02-12: Sidebar Avatar Menu and Logout Confirm

## Scope
- Replace direct avatar click-to-profile behavior with an anchored avatar popup menu.
- Add AppShell-owned logout confirmation modal.
- Remove EnterPrompt corner logout button.
- Preserve strict pointer and wheel shielding to prevent canvas interaction leaks.

## Files Changed
- `src/components/Sidebar.tsx`
- `src/screens/AppShell.tsx`
- `src/screens/EnterPrompt.tsx`
- `src/ui/layers.ts`
- `src/assets/profile_icon.png`
- `src/assets/logout_icon.png`

## Summary of Changes
1. Avatar popup menu in sidebar:
- Avatar click now opens a fixed-position popup menu anchored to the avatar trigger.
- Menu entries:
  - Profile (`profile_icon.png`) -> opens existing AppShell profile modal.
  - Log Out (`logout_icon.png`) -> requests AppShell logout confirm modal.
- Popup supports:
  - viewport clamp and placement handling
  - outside click close
  - Escape close
  - strict stopPropagation shielding on trigger, popup, and buttons.

2. Logout confirm modal in AppShell:
- Added AppShell state and handlers for logout confirmation.
- Added centered confirm modal with:
  - Cancel
  - Log Out (red background, white text)
- Confirm action reuses existing auth path: `useAuth().logout()`.
- Added full backdrop and modal shielding to block canvas pointer and wheel reactions.
- Added layer constant:
  - `LAYER_MODAL_LOGOUT_CONFIRM = 3400`

3. EnterPrompt cleanup:
- Removed corner logout button from EnterPrompt UI.
- Removed unused related styles and translation usage from that screen.

## Shielding Notes
- New avatar popup and logout confirm modal include pointer and wheel stopPropagation on:
  - backdrop/wrapper
  - dialog/popup root
  - interactive children (buttons/inputs where applicable)
- Behavior target: canvas does not pan/zoom/drag while interacting with popup or modal.

## Validation
- `npm run build` passed after integration.
- Core acceptance flow to verify manually:
  - avatar click opens popup
  - Profile opens profile modal
  - Log Out opens confirm modal
  - confirm logs out successfully
  - EnterPrompt corner logout button no longer appears
