# Report 2026-02-08: Onboarding Overlay Fullscreen Input Block

## Scope
Fix onboarding input leak where the top-right fullscreen button could still be clicked while overlays were open.

Target states:
- Welcome1 fullscreen prompt open.
- EnterPrompt login overlay open.

## Root Cause
1. Fullscreen button was rendered at a higher z-index than overlay layers.
   - `src/screens/AppShell.tsx` used fullscreen button style z-index 2100.
   - `src/auth/LoginOverlay.tsx` backdrop used z-index 2000.
   - `src/screens/Welcome1.tsx` prompt backdrop used z-index 20.
2. Because fullscreen UI was above these overlays, pointer events reached the button.

## Changes Applied

### 1) Fullscreen handler guard and pointer block
File: `src/components/FullscreenButton.tsx`
- Added `blocked?: boolean` prop.
- Added handler guard: early return when blocked.
- Added style guard: `pointerEvents: blocked ? 'none' : 'auto'`.
- Added `aria-disabled={blocked}`.

This is a safety rail even if stacking order regresses later.

### 2) Overlay-open wiring to AppShell
File: `src/screens/AppShell.tsx`
- Added state flags:
  - `welcome1OverlayOpen`
  - `enterPromptOverlayOpen`
- Derived `isOnboardingOverlayOpen`.
- Passed `blocked={isOnboardingOverlayOpen}` to `FullscreenButton`.
- Passed overlay state callbacks into screen components.
- Lowered onboarding fullscreen button z-index to 1200.

### 3) Welcome1 overlay state + backdrop hardening
File: `src/screens/Welcome1.tsx`
- Added prop `onOverlayOpenChange?: (open: boolean) => void`.
- Reports prompt open/close state to parent.
- Adds unmount cleanup to clear parent overlay flag.
- Backdrop changed to full viewport top layer:
  - `position: fixed`
  - `inset: 0`
  - `zIndex: 3000`
  - `pointerEvents: 'auto'`

### 4) EnterPrompt overlay state propagation
File: `src/screens/EnterPrompt.tsx`
- Added prop `onOverlayOpenChange?: (open: boolean) => void`.
- Centralized `loginOverlayOpen = !user && !isOverlayHidden`.
- Reports open/close state to parent.
- Adds unmount cleanup to clear parent overlay flag.
- Uses `loginOverlayOpen` for `LoginOverlay` `open` prop.

### 5) LoginOverlay z-index hardening
File: `src/auth/LoginOverlay.tsx`
- Backdrop z-index changed from 2000 to 3000.

## Verification

### Build/Type Check
- Ran: `npm run build`
- Result: success (`tsc` + `vite build` completed).

### Manual Acceptance Steps
1. Enable onboarding and open Welcome1 fullscreen prompt.
2. Click top-right fullscreen icon.
   - Expected: no hover/click effect, no fullscreen toggle.
3. Move to EnterPrompt with login overlay open.
4. Click top-right fullscreen icon.
   - Expected: no hover/click effect, no fullscreen toggle.
5. Close overlay and click fullscreen icon again.
   - Expected: fullscreen toggles normally.

## Notes
- This fix uses both layering and handler-level blocking, so behavior remains safe even if future z-index changes reintroduce visual overlap.
