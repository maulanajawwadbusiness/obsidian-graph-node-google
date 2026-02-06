# Welcome Cursor Overlay Fix
**Date**: 2026-02-06
**Agent**: Codex
**Scope**: Prevent subtitle shift when cursor appears

## Summary
Positioned the cursor absolutely so it no longer affects layout when it appears.

## Changes
- Subtitle wrapper now `position: relative`.
- Cursor is absolutely positioned to the right so it does not push the text.

## Files Touched
- src/screens/Welcome1.tsx
- docs/report_2026_02_06_cursor_no_shift.md

## Manual Verification Notes
- Confirm the subtitle does not shift when the cursor appears.
