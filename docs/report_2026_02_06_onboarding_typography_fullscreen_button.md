# Onboarding Welcome1 Typography + Fullscreen Button Trim
**Date**: 2026-02-06
**Agent**: Codex
**Scope**: Welcome1 typography sizing and fullscreen button chrome

## Summary
Adjusted the splash typography so the subtitle is 50% larger and the title matches it, and removed the fullscreen button border. Auto-fullscreen remains enabled on mount.

## Changes
- Set `Welcome1` title and subtitle font size to 27px (50% larger than 18px) and matched cursor size.
- Removed the fullscreen button border by setting `border: none`.

## Files Touched
- src/screens/Welcome1.tsx
- src/components/FullscreenButton.tsx
- docs/report_2026_02_06_onboarding_typography_fullscreen_button.md

## Manual Verification Notes
- Load the app with onboarding enabled.
- Confirm the subtitle and title are the same size and 50% larger than before.
- Confirm the fullscreen button has no border.
- Confirm auto-fullscreen still attempts on page load (may require user interaction per browser policy).
