# Report 2026-02-14: Onboarding Screen Fade Transition (200ms)

## Scope
- Implemented onboarding-only screen fade transitions in `src/screens/AppShell.tsx`.
- Transition scope includes only onboarding state changes:
  - `welcome1 <-> welcome2`
  - `welcome2 <-> prompt`
- Transitions involving `graph` remain immediate and unchanged.

## Goals
- Add a premium-feel but sharp 200ms fade between onboarding screens.
- Keep visual motion bounded and deterministic.
- Keep existing graph boot and loading behavior untouched.

## Implementation Summary
1. Added onboarding transition constants:
   - `ONBOARDING_SCREEN_FADE_MS = 200`
   - `ONBOARDING_SCREEN_FADE_EASING = cubic-bezier(0.22, 1, 0.36, 1)`
2. Added onboarding screen classifier helper:
   - `isOnboardingScreen(screen)`
3. Added AppShell transition controller state:
   - `screenTransitionFrom`
   - `screenTransitionReady`
   - `prefersReducedMotion`
   - timer and rAF refs with epoch guard
4. Added `transitionToScreen(next)` helper:
   - Animates only if both current and next screens are onboarding screens.
   - Uses two-layer crossfade (from and to screen both mounted for transition window).
   - Uses epoch/timer guards so rapid transitions do not leave stale state.
5. Added reduced-motion handling:
   - Reads `prefers-reduced-motion: reduce` via `matchMedia` and falls back to instant transition.
6. Replaced onboarding navigation calls to use transition helper:
   - `Welcome1`, `Welcome2`, `EnterPrompt` callbacks in AppShell rendering branch.
   - Sidebar `onCreateNew` now routes via the same helper.
7. Added transition-layer styles:
   - absolute stacked layers
   - opacity-only animation
   - input shield during transition window

## Input and Overlay Notes
- Transition path includes a temporary input shield over the transitioning surface.
- Wheel/pointer events are blocked from leaking across layers during the 200ms window.
- Existing onboarding wheel guard and fullscreen overlay blocking remain active.

## Validation
- Build validation passed:
  - `npm run build`
  - `tsc` success
  - `vite build` success
- No repo-tracked files outside planned scope were modified.

## Risks and Follow-up
- Manual visual verification is still required for final UX judgment:
  - transition smoothness
  - no click-through during transition
  - no visual flash
- Current implementation intentionally excludes graph transitions to avoid coupling with lazy graph mount and loading overlay behavior.
