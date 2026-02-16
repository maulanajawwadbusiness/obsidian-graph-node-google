# Report: Graph Loading Transition Parity (2026-02-15)

## Scope
Step 3 only.
- Transition behavior parity for `graph_loading` with graph-class boundaries.
- No loading gate UI.
- No confirm behavior.
- No `GraphPhysicsPlaygroundShell` or `LoadingScreen` changes.
- No analysis trigger logic changes.

## Transition Boundaries Verified
1. `prompt -> graph_loading`
- Classified as graph boundary.
- Policy is non-animated (`animate=false`, `blockInput=false`).

2. `graph_loading -> graph`
- Classified as graph boundary.
- Policy is non-animated (`animate=false`, `blockInput=false`).

3. `graph_loading -> prompt`
- Classified as graph boundary.
- Policy is non-animated (`animate=false`, `blockInput=false`).

## Policy Contract
Transition policy source:
- `src/screens/appshell/transitions/transitionContract.ts`

Contracts now in place:
- `TransitionClass` (`onboarding` | `graph`)
- `TRANSITION_CLASS_BY_SCREEN: Record<AppScreen, TransitionClass>`
- `TRANSITION_POLICY_BY_CLASS: Record<TransitionClass, Record<TransitionClass, TransitionPolicy>>`

Animated onboarding override remains explicit only for:
- `welcome1 <-> welcome2`
- `welcome2 <-> prompt`

## No-Animation Rationale
Graph-class boundaries are forced non-animated to avoid one-frame flash and transition host layering risks before the dedicated loading gate UI is introduced.

## Transition Host Leak Prevention
In `src/screens/AppShell.tsx`, `OnboardingLayerHost` eligibility now additionally respects transition policy animation state.
This keeps graph-class boundaries out of onboarding crossfade host layers.

## Build Verification
Command used after each run:
- `npm run build`

Results:
- Run 1: pass
- Run 2: pass
- Run 3: pass

## Behavior Notes
- No other behavior changes were introduced.
- `graph_loading` now has explicit transition parity with graph-class boundaries.
