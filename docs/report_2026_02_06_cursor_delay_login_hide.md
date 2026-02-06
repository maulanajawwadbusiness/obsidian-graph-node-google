# Welcome Cursor Delay + Login Overlay Hide
**Date**: 2026-02-06
**Agent**: Codex
**Scope**: Welcome cursor timing and login overlay controls

## Summary
- Delayed the Welcome1 cursor by 500ms with an easy knob.
- Added a Hide button to the login overlay and wired it to dismiss the overlay.

## Changes
- Added `CURSOR_DELAY_MS` and `showCursor` state in Welcome1.
- Added `onHide` prop to LoginOverlay and a Hide button.
- Added local `isOverlayHidden` state in EnterPrompt to control overlay visibility.

## Files Touched
- src/screens/Welcome1.tsx
- src/auth/LoginOverlay.tsx
- src/screens/EnterPrompt.tsx
- docs/report_2026_02_06_cursor_delay_login_hide.md

## Manual Verification Notes
- Confirm the cursor appears 500ms after the subtitle renders.
- Click Hide and confirm the login overlay disappears.
