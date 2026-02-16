# Report: Graph Loading Bedrock (2026-02-15)

## Scope
Step 1 only: introduce `graph_loading` into the screen system as a type-safe bedrock.
No loading gate UI, no prompt routing change, no `GraphPhysicsPlaygroundShell` or `LoadingScreen` changes.

## Files Touched
- `src/screens/appshell/screenFlow/screenTypes.ts`
- `src/config/env.ts`
- `src/screens/appshell/screenFlow/screenStart.ts`
- `src/screens/appshell/screenFlow/screenFlowController.ts`
- `src/screens/appshell/transitions/transitionContract.ts`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/AppShell.tsx`

## Source Of Truth
`graph_loading` is now part of canonical screen truth in:
- `APP_SCREENS` in `src/screens/appshell/screenFlow/screenTypes.ts`
- `AppScreen` (derived union) in `src/screens/appshell/screenFlow/screenTypes.ts`

Dev start-screen parsing was aligned in:
- `OnboardingScreen` and parser in `src/config/env.ts`
- invalid-value warning text in `src/screens/appshell/screenFlow/screenStart.ts`

## Exhaustiveness And Safety Net
Added a compile-time coverage map:
- `SCREEN_CLASS_BY_ID: Record<AppScreen, 'onboarding' | 'graph'>`

This forces every `AppScreen` (including `graph_loading`) to be explicitly classified.
Helpers now derive from that map:
- `isOnboardingScreen(screen)`
- `isGraphClassScreen(screen)`

`isGraphClassScreen` is consumed by:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/transitions/transitionContract.ts`

## Mapping Coverage Applied
Explicit handling for `graph_loading` was added to:
- screen flow mappings (`getNextScreen`, `getBackScreen`)
- transition graph-boundary policy
- render mapping (`renderScreenContent` graph branch)
- AppShell graph-class guards

## Behavior Status
No intentional behavior change for Step 1 scope:
- prompt still routes to `graph`.
- loading gate UI is not implemented yet.
- graph runtime loading implementation is untouched.

## Build Verification
All runs verified with root command:
- `npm run build`

Observed result:
- TypeScript build and Vite production build passed after Run 1, Run 2, and Run 3.
