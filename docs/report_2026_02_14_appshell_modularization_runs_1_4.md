# AppShell Modularization Report: Runs 1 to 4

Date: 2026-02-14
Branch: wire-onboarding-screen-third-stable
Scope: AppShell modularization runs 1 through 4 with behavior parity as the primary constraint.

## 1. Objectives and Constraints

Primary objective:
- Reduce AppShell monolith risk by extracting well-defined seams in small steps.

Hard constraints applied during all runs:
- ASCII only in code and docs.
- Minimal diff mindset per mini-run.
- No intentional behavior changes.
- Keep graph mount rule intact (graph mounts only on graph screen).
- Keep onboarding transition behavior intact:
  - 200ms premium fade easing.
  - reduced-motion handling.
  - no remount pulse.
  - no pointer or wheel leakage during transition.
  - fullscreen button block behavior while onboarding overlays are open.
- No browser testing tools used.

Out of scope in runs 1 to 4:
- Saved interface logic changes.
- Money UI behavior changes.
- Overlay modal behavior changes (except pass-through refactor boundaries).
- Graph physics behavior changes.

## 2. Baseline Before Modularization

Before run 1:
- `src/screens/AppShell.tsx` was the central orchestrator with mixed responsibilities:
  - onboarding screen routing policy
  - transition state machine
  - render mapping for all screens
  - saved interfaces sync and commit logic
  - profile/logout/delete/search overlays
  - sidebar orchestration
- Initial measured size before run 4 extraction wave:
  - AppShell around 2100+ lines.

## 3. Run-by-Run Execution

### Run 1: Skeleton Creation (No Behavior Change)

Commit:
- `359f2da` `chore(appshell): add appshell modular folder skeleton`

What was done:
- Added modular folder tree and placeholders only.
- No imports changed.
- No existing runtime behavior touched.

Created paths:
- `src/screens/appshell/screenFlow/screenTypes.ts`
- `src/screens/appshell/screenFlow/screenStart.ts`
- `src/screens/appshell/screenFlow/screenFlowController.ts`
- `src/screens/appshell/transitions/transitionTokens.ts`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`
- `src/screens/appshell/overlays/useOnboardingOverlayState.ts`
- `src/screens/appshell/overlays/OnboardingChrome.tsx`
- `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts`
- `src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts`
- `src/screens/appshell/render/renderScreenContent.tsx`

Verification:
- `npm run build` passed.

### Run 2: Transition Seam Extraction

#### 2.1 Tokens
Commit:
- `fcc92cd` `refactor(appshell): extract onboarding transition tokens`

Changes:
- Extracted `ONBOARDING_SCREEN_FADE_MS` and `ONBOARDING_SCREEN_FADE_EASING` from AppShell.
- Moved `isOnboardingScreen` to modular location (later moved again in run 3.1 to screenFlow).

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/transitions/transitionTokens.ts`

Verification:
- `npm run build` passed.

#### 2.2 Transition Hook
Commit:
- `5ee3bc9` `refactor(appshell): extract onboarding transition hook`

Changes:
- Extracted transition state machine into hook:
  - transition from-screen state
  - transition ready state
  - reduced-motion media query handling
  - timer and rAF lifecycle
  - epoch guards for stale async completions
- AppShell now consumes hook outputs, preserving previous semantics.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`

Verification:
- `npm run build` passed.

#### 2.3 Onboarding Layer Host
Commit:
- `b70ef75` `refactor(appshell): extract onboarding layer host`

Changes:
- Moved crossfade render topology and transition shield into `OnboardingLayerHost`.
- Preserved key stability and layer ordering:
  - `transition-from-${screenTransitionFrom}`
  - `active-screen-${screen}`
- Preserved shield handlers and z-index ordering.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`

Verification:
- `npm run build` passed.

#### 2.4 Transition Audit
Result:
- Clean static audit for tokens, hook, and host parity.
- No fix commit required.

Key audit findings:
- Fade values unchanged.
- Reduced-motion path unchanged in behavior.
- Transition shield semantics unchanged.
- Fullscreen block wiring remained tied to onboarding overlay open state.

### Run 3: Screen Flow Policy Extraction

#### 3.1 Screen Types and Helpers
Commit:
- `d827f4b` `refactor(appshell): extract screen types and helpers`

Changes:
- Added `AppScreen` and helpers in `screenFlow`:
  - `APP_SCREENS`
  - `AppScreen`
  - `isOnboardingScreen`
  - `isAppScreen`
- Updated transitions hook and AppShell to import onboarding classifier from `screenFlow`.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/screenFlow/screenTypes.ts`
- `src/screens/appshell/transitions/transitionTokens.ts`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`

Verification:
- `npm run build` passed.

#### 3.2 Initial Screen Policy
Commit:
- `df14f91` `refactor(appshell): extract initial screen policy`

Changes:
- Moved start-screen computation and warning behavior to `screenStart.ts`.
- Preserved behavior:
  - onboarding disabled starts at graph
  - dev override applies if valid
  - invalid override warning once
  - persistence gate behavior unchanged

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/screenFlow/screenStart.ts`

Verification:
- `npm run build` passed.

#### 3.3 Flow Controller
Commit:
- `a1eaa8c` `refactor(appshell): extract screen flow controller`

Changes:
- Added pure routing helpers:
  - `getNextScreen`
  - `getBackScreen`
  - `getSkipTarget`
  - `getCreateNewTarget`
- Replaced inline screen-flow literals in AppShell mapping and create-new path.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/screenFlow/screenFlowController.ts`

Verification:
- `npm run build` passed.

#### 3.4 Audit
Result:
- Clean static audit.

Checks passed:
- Single `AppScreen` union source in `screenTypes.ts`.
- No duplicated `isOnboardingScreen` implementations.
- No circular import between `screenFlow` and `transitions`.

### Run 4: Render Mapping Extraction (Pure Function)

#### 4.1 Add Pure renderScreenContent
Commit:
- `dc2b90f` `refactor(appshell): add pure renderScreenContent mapping`

Changes:
- Implemented `renderScreenContent(args)` in:
  - `src/screens/appshell/render/renderScreenContent.tsx`
- Implemented pure `screen -> jsx` mapping for:
  - graph
  - welcome1
  - welcome2
  - prompt
- No hooks, refs, effects, or timers in the file.

Files:
- `src/screens/appshell/render/renderScreenContent.tsx`

Verification:
- `npm run build` passed.

#### 4.2 Integrate renderScreenContent in AppShell
Commit:
- `c2a61aa` `refactor(appshell): use renderScreenContent in AppShell`

Changes:
- Replaced inline AppShell mapping body with delegated pure function call.
- Kept OnboardingLayerHost behavior intact.
- Removed now-unused screen component imports from AppShell.

Files:
- `src/screens/AppShell.tsx`

Verification:
- `npm run build` passed.

#### 4.3 Audit
Result:
- Clean static audit.

Checks passed:
- `renderScreenContent.tsx` has no hooks or side effects.
- No circular imports with AppShell.
- No duplicate inline mapping function left in AppShell.
- Approx AppShell size reduction:
  - before run 4 integration: 2100 lines
  - after run 4 integration: 2043 lines

## 4. Verification Summary

Build checks:
- Build ran and passed after each mini-run that changed code.
- Command used: `npm run build` (`tsc && vite build`).

Available scripts were limited to:
- `dev`
- `build`
- `preview`

No `lint` or `typecheck` script existed in package scripts during these runs.

## 5. Risks Encountered and How They Were Managed

1. Transition fragility risk:
- Mitigated by extracting tokens, hook, and host in separate commits.
- Preserved keys, layer order, and shield handlers exactly.

2. Policy drift risk during screen flow extraction:
- Mitigated by preserving start-policy semantics and one-time warning behavior.
- Kept routing helper functions pure and deterministic.

3. Render remount risk:
- Mitigated by keeping crossfade mechanics in `OnboardingLayerHost` and extracting only screen mapping.

4. Scope creep risk:
- Mitigated by not touching saved interfaces, money logic, or modal overlay internals.

## 6. Current Modular State After Run 4

Transition seam is modularized:
- `src/screens/appshell/transitions/transitionTokens.ts`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`

Screen flow policy is modularized:
- `src/screens/appshell/screenFlow/screenTypes.ts`
- `src/screens/appshell/screenFlow/screenStart.ts`
- `src/screens/appshell/screenFlow/screenFlowController.ts`

Render mapping is modularized and pure:
- `src/screens/appshell/render/renderScreenContent.tsx`

AppShell remains orchestrator for:
- state ownership
- commit callbacks
- overlay/sidebar/modal rendering
- money UI placement
- saved-interface sync brain

## 7. Commit Ledger (Runs 1 to 4)

1. `359f2da` chore(appshell): add appshell modular folder skeleton
2. `fcc92cd` refactor(appshell): extract onboarding transition tokens
3. `5ee3bc9` refactor(appshell): extract onboarding transition hook
4. `b70ef75` refactor(appshell): extract onboarding layer host
5. `d827f4b` refactor(appshell): extract screen types and helpers
6. `df14f91` refactor(appshell): extract initial screen policy
7. `a1eaa8c` refactor(appshell): extract screen flow controller
8. `dc2b90f` refactor(appshell): add pure renderScreenContent mapping
9. `c2a61aa` refactor(appshell): use renderScreenContent in AppShell

## 8. Conclusion

Runs 1 to 4 completed with behavior-parity intent, strict scope control, and passing builds at each implementation stage.

Net result:
- AppShell is thinner and cleaner in responsibility boundaries.
- High-fragility seams (transitions, start policy, flow policy, render mapping) are now modularized.
- Critical UX invariants around onboarding transitions and shielding were preserved in extraction.
