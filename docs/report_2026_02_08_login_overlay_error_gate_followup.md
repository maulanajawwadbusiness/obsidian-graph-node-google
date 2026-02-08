# Report 2026-02-08: LoginOverlay Error Text Gate Follow-up

## Scope
Follow-up patch to hide the remaining auth error text in EnterPrompt LoginOverlay during dev by default.

## Problem
A red error block still appeared in LoginOverlay even after gating `GoogleLoginButton` status text.

Source:
- `src/auth/LoginOverlay.tsx` rendered `useAuth().error` directly.
- This error can contain `html response; <!doctype html> ... @vite/client ...` when `/me` resolves to frontend HTML in dev.

## Change Applied
File: `src/auth/LoginOverlay.tsx`

- Added:
  - `SHOW_LOGIN_DEBUG_ERRORS = import.meta.env.VITE_SHOW_LOGIN_DEBUG_ERRORS === '1' || !import.meta.env.DEV`
- Updated error render condition:
  - from: `error && ...`
  - to: `SHOW_LOGIN_DEBUG_ERRORS && error && ...`

## Result
- Dev default: LoginOverlay auth error text hidden.
- Prod default: LoginOverlay auth error text visible.
- Debug override: set `VITE_SHOW_LOGIN_DEBUG_ERRORS=1` to force visibility in dev.

## Verification
- Ran `npm run build` successfully.
- Expected runtime in dev: no red auth error text unless debug env override is enabled.
