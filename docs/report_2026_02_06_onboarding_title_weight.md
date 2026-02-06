# Onboarding Welcome1 Title Weight Increase
**Date**: 2026-02-06
**Agent**: Codex
**Scope**: Welcome1 title weight adjustment

## Summary
Increased the "Arnvoid" title font weight by 300. Since common CSS font-weight values cap at 900, the value was set from 700 to 900.

## Change
- `Welcome1` title font weight: 700 -> 900.

## Files Touched
- src/screens/Welcome1.tsx
- docs/report_2026_02_06_onboarding_title_weight.md

## Manual Verification Notes
- Confirm the title appears visually heavier than before.
- If the current font does not support 900, consider mapping to a supported weight in fonts.css.
