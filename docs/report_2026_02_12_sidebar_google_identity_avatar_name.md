# Report 2026-02-12: Sidebar Google Identity Avatar and Name

## Scope
- Replace static sidebar account row placeholder with authenticated Google identity data.
- Keep existing placeholder behavior when user is not signed in.

## Files Changed
- `src/components/Sidebar.tsx`
- `src/screens/AppShell.tsx`

## What Changed
1. Sidebar account props added:
- `accountName?: string`
- `accountImageUrl?: string`

2. Sidebar avatar row now renders:
- Google profile photo when `accountImageUrl` is available.
- Existing `BA` circle placeholder when image URL is not available.
- Account label from `accountName`, fallback to `Your Name`.

3. Pointer safety hardening:
- Added `onPointerDown={(e) => e.stopPropagation()}` on the avatar button to prevent canvas pointer capture conflicts.

4. AppShell wiring:
- Reused existing `useAuth()` state.
- Passed `accountName` from `user.name` with fallback to `user.email`.
- Passed `accountImageUrl` from `user.picture` with string guards.

## Behavior Contract
- Signed in with picture and name: show picture + name.
- Signed in with no name: show email.
- Signed in with no picture: show `BA` placeholder + name or email.
- Signed out: keep existing `BA` + `Your Name`.

## Verification
- Build validation executed after changes.
- Manual UI scenarios to verify:
  - Signed out placeholder remains unchanged.
  - Signed in state shows Google account identity in sidebar bottom row.
  - Sidebar expand/collapse and row hover behavior remain unchanged.
