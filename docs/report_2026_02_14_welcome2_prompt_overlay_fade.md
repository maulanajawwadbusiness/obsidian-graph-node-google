# Report 2026-02-14: Welcome2 to EnterPrompt Transition Visibility Hardening

## Scope
- Refined transition perception for `welcome2 -> prompt` and all prompt entries.
- No backend changes.
- No graph-screen transition policy changes.

## Problem
- AppShell already crossfades onboarding screens over 200ms.
- EnterPrompt mounts `LoginOverlay` immediately when unauthenticated.
- `LoginOverlay` is portaled (`z-index: 5000`) and visually covers the underlying screen fade, making transition feel abrupt.

## Change Implemented
File changed:
- `src/auth/LoginOverlay.tsx`

Behavior changes:
1. Added overlay fade-in timing tokens:
   - `OVERLAY_FADE_MS = 200`
   - `OVERLAY_FADE_EASING = cubic-bezier(0.22, 1, 0.36, 1)`
2. Added reduced-motion support using `matchMedia('(prefers-reduced-motion: reduce)')`.
3. Added one-frame staged fade-in state:
   - start at opacity 0 when opened
   - move to opacity 1 on next animation frame
4. Applied opacity transition on the backdrop root while preserving:
   - immediate pointer and wheel blocking
   - body scroll lock while open

## Why This Fix
- Keeps AppShell screen crossfade visible and coherent.
- Prevents login overlay from snapping in at full opacity on top of the transition.
- Maintains input ownership and shielding guarantees.

## Validation
- `npm run build` passed (`tsc` + `vite build`).

## Manual QA Checklist
1. Logged-out flow: `welcome2 -> prompt` should feel smooth with no abrupt overlay snap.
2. Prompt opened from non-onboarding path should also show smooth login overlay fade-in.
3. Overlay must still block input and wheel immediately on open.
4. With reduced motion enabled, overlay should appear without animated fade.
