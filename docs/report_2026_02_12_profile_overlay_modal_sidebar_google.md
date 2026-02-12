# Report: Profile Overlay Modal From Sidebar Avatar (2026-02-12)

## Scope
- Add profile overlay modal opened from the sidebar avatar section.
- Keep modal state in `AppShell`.
- Persist `displayName` and `username` to backend DB.
- Keep photo read-only.
- Keep hard pointer and wheel shielding so canvas never reacts while modal is active.

## Files Changed
- `src/components/Sidebar.tsx`
- `src/screens/AppShell.tsx`
- `src/ui/layers.ts`
- `src/api.ts`
- `src/auth/AuthProvider.tsx`
- `src/server/src/serverMonolith.ts`
- `src/server/src/authSchemaGuard.ts`
- `src/server/migrations/1770383500000_add_user_profile_fields.js`
- `docs/report_2026_02_05_auth_session_postgres.md`

## Implementation Summary
1. Sidebar to AppShell click plumbing
- Added `onOpenProfile?: () => void` prop to `Sidebar`.
- Avatar row now emits `onOpenProfile` on click.
- Avatar section keeps pointer and wheel shielding.

2. AppShell-owned profile overlay
- Added AppShell state:
  - `isProfileOpen`
  - `profileDraftDisplayName`
  - `profileDraftUsername`
  - `profileSaving`
  - `profileError`
- Overlay is centered and closes on Escape and backdrop click.
- Added full `hardShieldInput` coverage on backdrop, modal, inputs, and buttons.
- Added `LAYER_MODAL_PROFILE` (`3300`) to keep ordering stable.

3. Backend persistence
- Added migration `1770383500000_add_user_profile_fields.js`:
  - `users.display_name` (text, nullable)
  - `users.username` (text, nullable)
  - `users_username_idx` (non-unique index)
- Added `POST /api/profile/update` (auth required) with validation:
  - `displayName`: trim + collapse spaces, max 80 chars
  - `username`: trim, max 32 chars, allowed chars `[A-Za-z0-9_.-]`
  - empty values clear to `null`
- Extended `/me` and `/auth/google` response payload to include:
  - `displayName`
  - `username`

4. Frontend API and auth typing
- Added `updateProfile({ displayName, username })` helper in `src/api.ts`.
- Updated `AuthProvider` `User` shape for profile fields and `/me` compatibility.

5. Immediate UI update path
- On Save in modal:
  - call `updateProfile`
  - call `refreshMe()`
  - close modal on success
- Sidebar account label now prefers:
  - `user.displayName`
  - fallback `user.name`
  - fallback `user.email`

## Input Shielding Verification Points
- Profile overlay backdrop uses pointer and wheel stop propagation.
- Modal container uses pointer and wheel stop propagation.
- Inputs and action buttons use pointer and wheel stop propagation.
- Result: while modal is open, graph canvas does not receive interaction input.

## Manual Verification Checklist
1. Open profile modal from sidebar on prompt screen.
2. Open profile modal from sidebar on graph screen.
3. Scroll and click inside modal: canvas does not pan/zoom/drag.
4. Save valid display name and username:
   - sidebar updates after save
5. Reload page:
   - values persist
6. Sign in on another device with same Google account:
   - values match
7. Sign in as different Google account:
   - no profile bleed

## Build Verification
- Frontend: `npm run build` passed.
- Backend: `npm run build` from `src/server` passed.

## Notes
- Username uniqueness is intentionally non-unique in this release for minimal diff.
- Photo remains read-only and sourced from Google account data.
