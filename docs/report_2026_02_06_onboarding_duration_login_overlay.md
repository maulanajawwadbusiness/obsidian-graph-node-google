# Onboarding Duration + Login Overlay Fix
**Date**: 2026-02-06
**Agent**: Codex
**Scope**: Onboarding timing and login overlay behavior

## Summary
- Tripled the default durations for onboarding screens 1 and 2.
- Standardized login box text capitalization.
- Fixed login overlay to close immediately after login by binding `open` to auth state.

## Changes
- `ONBOARDING_SPLASH_MS`: 1500 -> 4500
- `ONBOARDING_MANIFESTO_MS`: 2000 -> 6000
- Login overlay now uses `open={!user}`.
- Capitalized login-related labels and status strings.

## Files Touched
- src/config/env.ts
- src/screens/EnterPrompt.tsx
- src/auth/LoginOverlay.tsx
- src/components/GoogleLoginButton.tsx
- docs/report_2026_02_06_onboarding_duration_login_overlay.md

## Manual Verification Notes
- Confirm screen 1 and 2 durations are 4.5s and 6s by default.
- Log in on screen 3 and confirm overlay disappears immediately.
- Verify login box text capitalization.
