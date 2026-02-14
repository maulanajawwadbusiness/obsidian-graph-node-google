# AppShell Modularization Report (Runs 1-8)

Date: 2026-02-14
Scope: Post-stability architecture report for AppShell modularization and seam ownership.
Reference branch context: `wire-onboarding-screen-third-stable`

## 1. Outcome

- AppShell was reduced from a historical monolithic shape (>2500 lines in prior iterations) to orchestration-only at `447` lines in `src/screens/AppShell.tsx`.
- The modularization was executed with parity-first mini-runs, with `npm run build` passing after each code-changing mini-run.
- Manual smoke checks used across the run sequence were reported as passing in prior run audits (transitions, overlays, saved interfaces, fullscreen blocking, and modal shielding).
- The implementation now concentrates domain logic under `src/screens/appshell/*` and keeps AppShell as wiring/dependency injection.

## 2. Invariants (Do Not Break)

### Onboarding transitions
- Fade contract: `200ms` premium fade and current easing token.
- Reduced-motion path must preserve behavior parity.
- No remount pulse and no onboarding prompt/login flicker.

### Fullscreen safety
- Fullscreen remains explicit-only.
- Fullscreen button input is blocked while onboarding overlays are open.

### Overlay and modal shielding
- Overlays/modals must own pointer and wheel input.
- Canvas must never react under active overlays/modals.

### Saved interfaces
- AppShell remains single writer at orchestration level.
- Rename must not reorder sessions (no payload `updatedAt` bump on rename).
- Restore path is read-only (no write side effects and no outbox drain side effects).
- Ordering truth is payload timestamps, not DB row timestamps.
- Outbox keeps retry policy and identity isolation.

## 3. New Module Map

- `src/screens/appshell/screenFlow/*`
  - `screenTypes.ts`
  - `screenStart.ts`
  - `screenFlowController.ts`
  - `useWelcome1FontGate.ts`
- `src/screens/appshell/transitions/*`
  - `transitionTokens.ts`
  - `useOnboardingTransition.ts`
  - `OnboardingLayerHost.tsx`
  - `useOnboardingWheelGuard.ts`
- `src/screens/appshell/overlays/*`
  - `useOnboardingOverlayState.ts`
  - `OnboardingChrome.tsx`
  - `useAppShellModals.ts`
  - `ModalLayer.tsx`
  - `useProfileController.ts`
  - `useLogoutConfirmController.ts`
  - `useSearchInterfacesEngine.ts`
- `src/screens/appshell/savedInterfaces/*`
  - `savedInterfacesCommits.ts`
  - `useSavedInterfacesSync.ts`
- `src/screens/appshell/render/*`
  - `renderScreenContent.tsx`
- `src/screens/appshell/sidebar/*`
  - `SidebarLayer.tsx`
  - `useSidebarInterfaces.ts`
- `src/screens/appshell/appShellHelpers.ts`
- `src/screens/appshell/appShellStyles.ts`

## 4. Seam Guide (Where To Edit X)

- Change onboarding fade timing/easing: `src/screens/appshell/transitions/transitionTokens.ts`
- Change onboarding transition state machine: `src/screens/appshell/transitions/useOnboardingTransition.ts`
- Change onboarding wheel guard: `src/screens/appshell/transitions/useOnboardingWheelGuard.ts`
- Change initial screen policy: `src/screens/appshell/screenFlow/screenStart.ts`
- Change screen flow mapping: `src/screens/appshell/screenFlow/screenFlowController.ts`
- Change screen to component mapping: `src/screens/appshell/render/renderScreenContent.tsx`
- Change onboarding overlay coordination: `src/screens/appshell/overlays/useOnboardingOverlayState.ts`
- Change onboarding fullscreen chrome: `src/screens/appshell/overlays/OnboardingChrome.tsx`
- Change search overlay ranking/filter behavior: `src/screens/appshell/overlays/useSearchInterfacesEngine.ts`
- Change non-onboarding modal open/close rules: `src/screens/appshell/overlays/useAppShellModals.ts`
- Change modal rendering/shielding: `src/screens/appshell/overlays/ModalLayer.tsx`
- Change saved interface write surfaces: `src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts`
- Change saved interface hydrate/outbox sync: `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts`
- Change sidebar wiring: `src/screens/appshell/sidebar/SidebarLayer.tsx` and `src/screens/appshell/sidebar/useSidebarInterfaces.ts`

## 5. Verification Checklist

Run:
- `npm run build`

Manual checks:
- welcome1 to welcome2 fade
- welcome2 to prompt fade
- prompt to graph transition
- create-new flow from sidebar
- restore interface flow
- rename without reorder
- delete confirm flow
- search overlay shielding (pointer and wheel do not leak)
- fullscreen blocked during onboarding overlays

## 6. Commit Log (Runs 2-8, grouped)

### Run 2: Transition seam
- `fcc92cd` refactor(appshell): extract onboarding transition tokens
- `5ee3bc9` refactor(appshell): extract onboarding transition hook
- `b70ef75` refactor(appshell): extract onboarding layer host

### Run 3: Screen flow policy
- `d827f4b` refactor(appshell): extract screen types and helpers
- `df14f91` refactor(appshell): extract initial screen policy
- `a1eaa8c` refactor(appshell): extract screen flow controller

### Run 4: Render mapping
- `dc2b90f` refactor(appshell): add pure renderScreenContent mapping
- `c2a61aa` refactor(appshell): use renderScreenContent in AppShell

### Run 5: Onboarding overlays and chrome
- `61215b2` refactor(appshell): extract onboarding overlay state hook
- `e6dfbda` refactor(appshell): extract onboarding chrome fullscreen logic

### Run 6: Saved interfaces split
- `d2f337d` refactor(appshell): extract saved interfaces commit surfaces
- `0291669` refactor(appshell): wire saved interfaces commit surfaces
- `8065651` refactor(appshell): extract saved interfaces sync engine hook
- `39545d6` refactor(appshell): wire saved interfaces sync engine

### Run 7: Non-onboarding modal modularization
- `98b01b0` refactor(appshell): extract app-shell modal state hook
- `92dcd93` refactor(appshell): extract modal layer renderer

### Run 8: Orchestration-only AppShell
- `bb7a534` refactor(appshell): extract onboarding wheel guard hook
- `56a6c5a` refactor(appshell): extract welcome1 font gate hook
- `ea70e5f` refactor(appshell): extract profile/logout controllers and collapse ModalLayer props
- `916ea2c` refactor(appshell): extract search interfaces engine and collapse search props
- `222769f` refactor(appshell): collapse sidebar wiring into layer

## 7. Key Outcomes Snapshot

- AppShell now coordinates modules instead of implementing domain internals.
- High-risk seams (transitions and saved interfaces) were isolated and audited.
- Overlay and modal shielding stayed explicit and centralized.
- Saved interface write and sync invariants remain enforced with dedicated modules.
