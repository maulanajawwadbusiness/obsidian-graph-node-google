# Report: Login Overlay on Prompt Screen
Date: 2026-02-06

## Summary
- Added a prompt-screen login overlay that reuses the existing Google login flow.
- Overlay blocks pointer and wheel events and disables background scroll while open.
- Continue button enables only when a user is signed in.

## What Changed
- Added `src/auth/LoginOverlay.tsx`.
- Mounted overlay in `src/screens/EnterPrompt.tsx` with `onContinue`, `onBack`, and `onSkip` wired to the onboarding flow.

## How To Test
1) Set `VITE_ONBOARDING_ENABLED=true`.
2) Navigate to the prompt screen.
3) Verify the login overlay appears and blocks background interaction.
4) If not logged in, use Google sign-in and confirm signed-in state appears.
5) Verify Continue is enabled only when signed in.
6) Click Continue to reach the graph screen.
7) Refresh on prompt while signed in and confirm the overlay shows the signed-in state immediately.
8) Set `VITE_ONBOARDING_ENABLED=false` and confirm the app goes directly to graph without showing the overlay.
