# AppShell Modularization Forensic Report: Runs 1 to 7

Date: 2026-02-14
Branch: wire-onboarding-screen-third-stable
Scope: Full forensic record for AppShell modularization runs 1 through 7.
Supersedes: docs/report_2026_02_14_appshell_modularization_runs_1_4.md for later runs.

## 1. Executive Summary

Runs 1-7 were executed as a staged, behavior-parity-first refactor of `src/screens/AppShell.tsx`.

Primary outcomes:
- High fragility seams were split into dedicated modules with minimal behavioral movement.
- Onboarding transition and fullscreen blocking contracts were preserved.
- Saved interfaces logic was split into write commit surfaces and sync engine while keeping AppShell as single writer.
- Non-onboarding modals were split into one modal-state hook and one renderer layer with strong input shielding.
- Build checks passed after each code mini-run.

Net shape after run 7:
- AppShell remains orchestrator and dependency injector.
- AppShell no longer owns inline implementations for several large seams.
- Modular seams now exist for transitions, screen flow policy, render mapping, onboarding overlays/chrome, saved interface commits/sync, and non-onboarding modal state/render.

## 2. Global Constraints and Safety Rules Applied

Hard constraints used in all runs:
- ASCII only in code and docs.
- Minimal diff per mini-run.
- No intentional behavior changes.
- No browser testing tools.
- `npm run build` required after every code-changing mini-run.

Critical invariants preserved:
- Onboarding transition behavior (200ms fade, reduced motion path, no remount pulse).
- Fullscreen remains explicit-only and blocked by onboarding overlays when open.
- AppShell remains saved-interfaces single writer.
- Rename must not reorder saved interfaces (no payload updatedAt bump on rename).
- Ordering truth uses payload timestamps, not DB row timestamps.
- Restore path stays read-only (no write side effects, no outbox drain side effects).
- Overlay and modal shielding blocks pointer and wheel leakage to canvas.

## 3. Baseline Before Modularization

Before run 1:
- `src/screens/AppShell.tsx` carried mixed responsibilities:
  - onboarding flow and transitions
  - onboarding fullscreen logic and overlay coordination
  - screen render mapping
  - saved interface write and sync engine logic
  - profile/logout/delete/search modal state and rendering
  - sidebar wiring and multiple UX side effects

This was the risk target for progressive seam extraction.

## 4. Detailed Run Timeline

## 4.1 Run 1: Skeleton (No Behavior Change)

Commit:
- `359f2da` `chore(appshell): add appshell modular folder skeleton`

What was done:
- Created initial modular folder skeleton and placeholder files only.
- No import rewiring.
- No runtime behavior touched.

Created files:
- `src/screens/appshell/overlays/OnboardingChrome.tsx`
- `src/screens/appshell/overlays/useOnboardingOverlayState.ts`
- `src/screens/appshell/render/renderScreenContent.tsx`
- `src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts`
- `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts`
- `src/screens/appshell/screenFlow/screenFlowController.ts`
- `src/screens/appshell/screenFlow/screenStart.ts`
- `src/screens/appshell/screenFlow/screenTypes.ts`
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`
- `src/screens/appshell/transitions/transitionTokens.ts`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`

Verification:
- `npm run build` passed.

## 4.2 Run 2: Transition Seam Extraction

### 2.1 Tokens
Commit:
- `fcc92cd` `refactor(appshell): extract onboarding transition tokens`

Changes:
- Moved transition token constants from AppShell to `transitionTokens.ts`.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/transitions/transitionTokens.ts`

### 2.2 Hook
Commit:
- `5ee3bc9` `refactor(appshell): extract onboarding transition hook`

Changes:
- Moved transition state machine logic into `useOnboardingTransition.ts`.
- Includes rAF/timer lifecycle and reduced-motion matching.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`

### 2.3 Layer Host
Commit:
- `b70ef75` `refactor(appshell): extract onboarding layer host`

Changes:
- Moved crossfade DOM topology and transition shield to `OnboardingLayerHost.tsx`.
- Preserved key behavior:
  - `transition-from-${screenTransitionFrom}`
  - `active-screen-${screen}`

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`

### 2.4 Audit
Result:
- Clean audit. No fix commit required.
- Fade values, reduced-motion, shield behavior, and fullscreen blocking path remained equivalent.

Verification:
- Build passed after each code mini-run.

## 4.3 Run 3: Screen Flow Policy Extraction

### 3.1 Types and helpers
Commit:
- `d827f4b` `refactor(appshell): extract screen types and helpers`

Changes:
- Centralized AppScreen union and onboarding classifier in `screenTypes.ts`.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/screenFlow/screenTypes.ts`
- `src/screens/appshell/transitions/transitionTokens.ts`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`

### 3.2 Initial screen policy
Commit:
- `df14f91` `refactor(appshell): extract initial screen policy`

Changes:
- Moved startup screen policy and dev warning to `screenStart.ts`.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/screenFlow/screenStart.ts`

### 3.3 Flow controller
Commit:
- `a1eaa8c` `refactor(appshell): extract screen flow controller`

Changes:
- Moved next/back/skip/create-target route decisions to `screenFlowController.ts`.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/screenFlow/screenFlowController.ts`

### 3.4 Audit
Result:
- Clean audit. No fix commit required.
- Single screen type truth and no circular import regressions.

Verification:
- Build passed after each code mini-run.

## 4.4 Run 4: Render Mapping Extraction

### 4.1 Pure mapping function
Commit:
- `dc2b90f` `refactor(appshell): add pure renderScreenContent mapping`

Changes:
- Added pure `renderScreenContent(...)` switch mapping in `renderScreenContent.tsx`.
- No hooks/effects/state in that module.

Files:
- `src/screens/appshell/render/renderScreenContent.tsx`

### 4.2 AppShell integration
Commit:
- `c2a61aa` `refactor(appshell): use renderScreenContent in AppShell`

Changes:
- Replaced large inline screen JSX mapping with delegated call.

Files:
- `src/screens/AppShell.tsx`

### 4.3 Audit
Result:
- Clean audit. No fix commit required.

Verification:
- Build passed after each code mini-run.

## 4.5 Run 5: Onboarding Overlay Coordination and Fullscreen Chrome

### 5.1 Overlay state hook
Commit:
- `61215b2` `refactor(appshell): extract onboarding overlay state hook`

Changes:
- Added `useOnboardingOverlayState.ts` for onboarding overlay state and blocker derivation.
- Preserved `isOnboardingOverlayOpen = welcome1OverlayOpen || enterPromptOverlayOpen`.
- Preserved prompt-leave cleanup for enter prompt overlay state.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/overlays/useOnboardingOverlayState.ts`

Issue handled:
- Initial build error due to unused destructured variable in AppShell after extraction.
- Resolved by removing unused binding only.

### 5.2 Onboarding chrome component
Commit:
- `e6dfbda` `refactor(appshell): extract onboarding chrome fullscreen logic`

Changes:
- Added `OnboardingChrome.tsx` and moved fullscreen icon rendering/wiring there.
- Preserved explicit-only fullscreen entry path.
- Preserved blocked wiring: `blocked={isOnboardingOverlayOpen}`.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/overlays/OnboardingChrome.tsx`

### 5.3 Audit
Result:
- Clean audit.
- No behavior risk found.

Verification:
- Build passed after 5.1, 5.2, and final audit run.

## 4.6 Run 6: Saved Interfaces Split (Commit Surfaces vs Sync Engine)

### 6.1 Extract commit surfaces module
Commit:
- `d2f337d` `refactor(appshell): extract saved interfaces commit surfaces`

Changes:
- Implemented `createSavedInterfacesCommitSurfaces(...)` in `savedInterfacesCommits.ts` with:
  - `commitUpsertInterface`
  - `commitPatchLayoutByDocId`
  - `commitRenameInterface`
  - `commitDeleteInterface`
  - `commitHydrateMerge`
- Kept restore write-block guards.
- Kept rename title-only semantics.

Files:
- `src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts`

### 6.2 Wire commit surfaces into AppShell
Commit:
- `0291669` `refactor(appshell): wire saved interfaces commit surfaces`

Changes:
- Replaced inline commit function bodies in AppShell with module surfaces.

Files:
- `src/screens/AppShell.tsx`

### 6.3 Extract sync engine hook
Commit:
- `8065651` `refactor(appshell): extract saved interfaces sync engine hook`

Changes:
- Added `useSavedInterfacesSync.ts` with identity-aware outbox, remote hydrate/merge, retry/backoff, and guard logic.

Files:
- `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts`

### 6.4 Wire sync engine into AppShell
Commit:
- `39545d6` `refactor(appshell): wire saved interfaces sync engine`

Changes:
- Removed inline sync engine internals from AppShell.
- AppShell now injects dependencies and consumes hook outputs.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts`

Issue/conflict handled:
- Wiring cycle risk discovered while integrating 6.4:
  - commit surfaces needed enqueue functions from sync layer
  - sync hydration initially depended on commit-hydrate callback
- Resolution:
  - sync hook hydrates through injected `applySavedInterfacesState(...)`
  - commit surfaces consume enqueue callbacks from sync hook
  - preserved single writer and behavior semantics

### 6.5 Steel audit
Result:
- Clean audit.
- Invariants confirmed with code checks:
  - rename no reorder
  - restore read-only
  - payload timestamp ordering truth
  - identity + epoch + storage-key outbox guards

Verification:
- Build passed after each code mini-run and after audit.

## 4.7 Run 7: Non-Onboarding Modals and Overlay Rendering

### 7.1 Extract modal state hook
Commit:
- `98b01b0` `refactor(appshell): extract app-shell modal state hook`

Changes:
- Added `useAppShellModals.ts` owning state/handlers/effects for:
  - search interfaces overlay
  - delete confirm modal
  - profile modal
  - logout confirm modal
- Preserved close/open rules, escape handling, and search focus behavior.

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/overlays/useAppShellModals.ts`

### 7.2 Extract modal renderer layer
Commit:
- `92dcd93` `refactor(appshell): extract modal layer renderer`

Changes:
- Added `ModalLayer.tsx` and moved all non-onboarding modal JSX there.
- Preserved stacking order and per-control shielding.
- Added root capture shielding at modal-layer root:
  - `onPointerDownCapture` stopPropagation
  - `onWheelCapture` stopPropagation

Files:
- `src/screens/AppShell.tsx`
- `src/screens/appshell/overlays/ModalLayer.tsx`

Issues handled:
- Initial compile error after extraction due to missing `closeSearchInterfaces` prop in `ModalLayer`.
- Resolved with minimal prop addition and wiring update.

### 7.3 Audit
Result:
- Clean audit.
- No duplicate modal state in AppShell.
- Non-onboarding modal rendering centralized in `ModalLayer`.
- Shielding is at least as strong as prior behavior.
- No circular import back into AppShell.

Verification:
- Build passed after 7.1, 7.2, and final 7.3 audit build.

## 5. Behavioral Incidents and Resolutions

Observed refactor incidents:
1. Run 5.1 unused variable compile failure after hook extraction.
- Cause: stale destructured modal variable not used.
- Fix: removed unused binding.
- Behavior impact: none.

2. Run 6 integration dependency conflict between commit and sync seams.
- Cause: two-way dependency risk while splitting modules.
- Fix: sync hydrate writes through `applySavedInterfacesState`, while commit surfaces depend on sync enqueue callbacks.
- Behavior impact: none.

3. Run 7.2 missing prop compile failure in ModalLayer.
- Cause: `closeSearchInterfaces` not included in props after move.
- Fix: add prop and AppShell wiring.
- Behavior impact: none.

## 6. Verification Matrix

Validation command used:
- `npm run build` (tsc + vite build)

Result summary:
- All code-changing mini-runs from runs 1-7 ended with passing build.
- Intermediate compile breaks encountered during refactor were resolved immediately in the same run and revalidated.

## 7. Current Modular Architecture After Run 7

Transition domain:
- `src/screens/appshell/transitions/transitionTokens.ts`
- `src/screens/appshell/transitions/useOnboardingTransition.ts`
- `src/screens/appshell/transitions/OnboardingLayerHost.tsx`

Screen flow domain:
- `src/screens/appshell/screenFlow/screenTypes.ts`
- `src/screens/appshell/screenFlow/screenStart.ts`
- `src/screens/appshell/screenFlow/screenFlowController.ts`

Render mapping domain:
- `src/screens/appshell/render/renderScreenContent.tsx`

Onboarding overlay/chrome domain:
- `src/screens/appshell/overlays/useOnboardingOverlayState.ts`
- `src/screens/appshell/overlays/OnboardingChrome.tsx`

Saved interfaces domain:
- Commit surfaces: `src/screens/appshell/savedInterfaces/savedInterfacesCommits.ts`
- Sync engine: `src/screens/appshell/savedInterfaces/useSavedInterfacesSync.ts`

Non-onboarding modal domain:
- State hook: `src/screens/appshell/overlays/useAppShellModals.ts`
- Renderer: `src/screens/appshell/overlays/ModalLayer.tsx`

AppShell now primarily owns:
- high-level orchestration
- dependency injection across seams
- cross-domain glue between graph, sidebar, auth, and modular hooks/components

## 8. Invariant Status Checklist (Post Run 7)

Onboarding and fullscreen:
- explicit-only fullscreen preserved
- overlay block wiring preserved
- transition topology and keys preserved

Saved interfaces and sync:
- single writer preserved at AppShell orchestration level
- rename no reorder preserved
- payload timestamp ordering preserved
- restore read-only guards preserved
- outbox identity/epoch/storage guards preserved

Overlay input safety:
- modal/overlay shielding preserved
- modal layer now has capture-phase shield at root plus existing local shields

## 9. Complete Commit Ledger (Runs 1-7)

Run 1:
1. `359f2da` chore(appshell): add appshell modular folder skeleton

Run 2:
2. `fcc92cd` refactor(appshell): extract onboarding transition tokens
3. `5ee3bc9` refactor(appshell): extract onboarding transition hook
4. `b70ef75` refactor(appshell): extract onboarding layer host

Run 3:
5. `d827f4b` refactor(appshell): extract screen types and helpers
6. `df14f91` refactor(appshell): extract initial screen policy
7. `a1eaa8c` refactor(appshell): extract screen flow controller

Run 4:
8. `dc2b90f` refactor(appshell): add pure renderScreenContent mapping
9. `c2a61aa` refactor(appshell): use renderScreenContent in AppShell

Run 5:
10. `61215b2` refactor(appshell): extract onboarding overlay state hook
11. `e6dfbda` refactor(appshell): extract onboarding chrome fullscreen logic

Run 6:
12. `d2f337d` refactor(appshell): extract saved interfaces commit surfaces
13. `0291669` refactor(appshell): wire saved interfaces commit surfaces
14. `8065651` refactor(appshell): extract saved interfaces sync engine hook
15. `39545d6` refactor(appshell): wire saved interfaces sync engine

Run 7:
16. `98b01b0` refactor(appshell): extract app-shell modal state hook
17. `92dcd93` refactor(appshell): extract modal layer renderer

## 10. Final Statement

Runs 1-7 completed as progressive seam extraction with behavior parity as the governing constraint.

Refactor quality outcome:
- AppShell complexity reduced by moving dense logic into explicit domain modules.
- Critical contracts from onboarding, fullscreen safety, saved-interface ordering/write rules, and input shielding remained intact.
- Each major extraction was validated with build checks and focused parity audits.
