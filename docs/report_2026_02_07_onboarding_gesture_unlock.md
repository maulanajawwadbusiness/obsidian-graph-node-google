# Onboarding Gesture Unlock and Scroll Guard

Date: 2026-02-07
Scope: add first-gesture unlock flow for fullscreen retry and prevent onboarding scroll breaks, without touching typing cadence logic.

## Files Added or Updated

- Added: `src/hooks/useFirstUserGesture.ts`
- Updated: `src/screens/AppShell.tsx`
- Updated: `src/screens/Welcome2.tsx`

## Listeners Added and Where

1. First gesture listeners (window, capture phase)
- File: `src/hooks/useFirstUserGesture.ts`
- Events:
  - `pointerdown` (capture)
  - `keydown` (capture)
- Behavior:
  - triggers callback once
  - removes both listeners after first gesture
  - optional key prevention via `preventDefaultKeys`

2. Onboarding shell wheel guard (window, capture, non-passive)
- File: `src/screens/AppShell.tsx`
- Active only while onboarding screen is `welcome1`, `welcome2`, or `prompt`
- Event:
  - `wheel` with `{ passive: false, capture: true }`
- Behavior:
  - `preventDefault()` to stop page scroll during onboarding

3. Welcome2 local interaction guard
- File: `src/screens/Welcome2.tsx`
- Root container:
  - `tabIndex={0}` and autofocus on mount
  - keydown handler prevents scroll keys
  - pointerdown refocuses root for consistent key capture
- Local wheel guard:
  - root-level `wheel` listener with `{ passive: false }` to prevent scroll

## Prevented Keys and Why

Welcome2 keydown guard prevents:
- `Space`
- `PageDown`
- `PageUp`
- `ArrowDown`
- `ArrowUp`

Reason:
- these keys can scroll document and break immersion while typing animation is running.

First-gesture hook in AppShell also prevents space key for the initial unlock gesture when configured with:
- `preventDefaultKeys: [' ', 'Space']`

## Fullscreen Retry Behavior and Fallback

In `src/screens/AppShell.tsx`, `useFirstUserGesture` is used with onboarding-only enablement.

On first gesture:
- if onboarding is active and app is not already fullscreen:
  - attempts `document.documentElement.requestFullscreen()` once
- if blocked by browser policy:
  - error is swallowed
  - no spam logs
  - optional single debug log behind `DEBUG_ONBOARDING_GESTURE = false`

This does not require clicking fullscreen icon specifically. Any first pointer/keyboard gesture can unlock fullscreen retry.

## Flow Safety Notes

- Typing engine (`useTypedTimeline`) was not modified.
- Cadence and timeline behavior remain unchanged.
- Back/Skip handlers are unchanged and unmount path keeps listener cleanup via React effects.

## Verification Notes

- `npm run build` passed after changes.
- Code path checks:
  - first-gesture listener is one-shot and self-cleaning
  - onboarding wheel guard only active during onboarding screens
  - Welcome2 root is focusable and key/wheel guards are active without blocking button clicks
