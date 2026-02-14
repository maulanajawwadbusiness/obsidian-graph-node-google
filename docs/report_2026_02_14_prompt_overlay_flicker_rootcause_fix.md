# Report 2026-02-14: Prompt Overlay Flicker Root-Cause Fix

## Scope
- Fixed flicker during onboarding transition into `prompt` where prompt content and login overlay appeared to switch back and forth.
- Files changed:
  - `src/screens/AppShell.tsx`
  - `src/screens/EnterPrompt.tsx`

## Root Cause
Two issues combined:

1. Transition boundary remount churn in `AppShell`
- During fade, `AppShell` rendered inside transition container.
- After fade, render path switched to direct `renderScreenContent(screen)`.
- This remounted `EnterPrompt` at handoff boundary.

2. Unmount cleanup pulse in `EnterPrompt`
- `EnterPrompt` unmount cleanup called `onOverlayOpenChange(false)`.
- New mount then called `onOverlayOpenChange(true)`.
- The portal `LoginOverlay` was torn down and recreated, causing visible flicker.

## Fix Implemented
1. Stable onboarding layer host in `AppShell`
- Onboarding screens now render through a consistent layer host.
- During transition:
  - from-layer fades out
  - active-layer fades in
- After transition:
  - active-layer remains mounted in same host
  - only from-layer is removed
- This prevents `EnterPrompt` remount at fade boundary.

2. Explicit overlay state reset on prompt exit in `AppShell`
- Added effect: when `screen !== 'prompt'`, force `enterPromptOverlayOpen` to false.
- This replaces reliance on unmount cleanup from `EnterPrompt`.

3. Removed unmount cleanup pulse in `EnterPrompt`
- Removed effect cleanup that called `onOverlayOpenChange(false)` on unmount.
- Overlay open/close now follows explicit state updates instead of remount side effects.

## Validation
- `npm run build` passed (`tsc` + `vite build`).

## Manual QA Checklist
1. `welcome2 -> prompt` (logged out): no prompt/overlay back-and-forth flicker.
2. `prompt -> welcome2`: overlay state resets correctly and fullscreen button blocking state remains correct.
3. Repeat transition loop multiple times: stable behavior, no portal flicker.
4. Verify input shielding still holds during 200ms transition window.
