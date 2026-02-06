# Report: Onboarding Placeholders
Date: 2026-02-06

## Summary
- Added a minimal onboarding screen flow (welcome1 -> welcome2 -> prompt) with a simple state machine.
- Added env toggle `VITE_ONBOARDING_ENABLED` to enable or skip onboarding.
- Graph map page is now lazy-loaded and only mounted when the flow reaches the graph screen.

## Env Toggle
- `VITE_ONBOARDING_ENABLED` controls whether onboarding runs.
  - Missing or false: jump directly to graph.
  - True: start at welcome1.

## How To Test
1) Set `VITE_ONBOARDING_ENABLED=true` and run the app.
2) Verify: welcome1 -> next -> welcome2 -> next -> prompt -> enter -> graph.
3) Verify skip buttons jump to graph.
4) Refresh on a welcome screen to confirm the screen is restored (sessionStorage).
5) Set `VITE_ONBOARDING_ENABLED=false` and verify app starts on graph.

## Files Changed
- Added: `src/config/env.ts`
- Added: `src/screens/AppShell.tsx`
- Added: `src/screens/Welcome1.tsx`
- Added: `src/screens/Welcome2.tsx`
- Added: `src/screens/EnterPrompt.tsx`
- Updated: `src/main.tsx`
- Updated: `.env.local`
