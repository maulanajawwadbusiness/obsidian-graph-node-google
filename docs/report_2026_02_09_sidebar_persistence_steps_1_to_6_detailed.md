# Detailed Work Report: Sidebar Persistence Steps 1 to 6

Date: 2026-02-09
Scope: Consolidated implementation report for steps 1, 2, 3, 4, 5, and 6.

## 1. Objective

Implement persistent left sidebar behavior across prompt, graph loading, and graph ready states while preserving:

1. Existing graph loading and error UI surface.
2. Graph input safety laws (no sidebar interaction leaking into canvas drag/zoom/pan).
3. Minimal-diff approach without redesign.

## 2. Final Behavior After Step 6

1. Sidebar is rendered by `AppShell`, not `EnterPrompt`.
2. Sidebar is visible only on:
   - `screen === 'prompt'`
   - `screen === 'graph'`
3. Sidebar persists visually during graph loading and graph error surfaces.
4. Sidebar is non-interactable when:
   - `screen === 'graph' && graphIsLoading === true`
5. Sidebar is interactable on:
   - prompt screen
   - graph screen when not loading/error
6. LoadingScreen and error messaging remain unchanged.

## 3. Step-by-Step Implementation Summary

## Step 1: AppShell Owns Sidebar Layout

Files changed:

1. `src/screens/AppShell.tsx`
2. `src/screens/EnterPrompt.tsx`

Changes:

1. Lifted sidebar mount out of `EnterPrompt` and into `AppShell`.
2. Added shell-owned sidebar expansion state.
3. Refactored shell rendering into sibling layout:
   - sidebar rail
   - main screen container
4. Sidebar visibility rule in shell:
   - show only on prompt and graph.
5. Preserved onboarding and graph transitions.

Result:

- Sidebar no longer unmounts with `EnterPrompt`.

## Step 2: Remove EnterPrompt Sidebar Coupling and Fix Prompt Spacing

File changed:

1. `src/screens/EnterPrompt.tsx`

Changes:

1. Removed remaining sidebar import/mount/state from `EnterPrompt`.
2. Added minimal left gutter so prompt card does not sit under shell-owned rail:
   - `LEFT_RAIL_GUTTER_PX = 35`
   - `paddingLeft` on root container
   - `boxSizing: 'border-box'` on root container

Result:

- Prompt view remains visually grounded with shell-owned sidebar present.

## Step 3: Add Sidebar Disabled Mode API and Root Shielding

File changed:

1. `src/components/Sidebar.tsx`

Changes:

1. Added prop:
   - `disabled?: boolean` default `false`
2. Applied non-interactable root style when disabled:
   - `pointerEvents: disabled ? 'none' : 'auto'`
3. Added root event shielding:
   - `onPointerDown` stopPropagation
   - `onWheel` stopPropagation

Result:

- Sidebar component now supports shell-controlled interaction lock.

## Step 4: Wire Graph Loading Signal to AppShell

Files changed:

1. `src/playground/GraphPhysicsPlayground.tsx`
2. `src/screens/AppShell.tsx`

Changes:

1. Added optional prop to graph:
   - `onLoadingStateChange?: (isLoading: boolean) => void`
2. Unified loading truth in graph:
   - `isGraphLoading = aiActivity || Boolean(aiErrorMessage)`
3. Emitted loading state via effect when value changes.
4. Added shell state:
   - `graphIsLoading`
5. Passed callback from shell into graph:
   - `onLoadingStateChange={(v) => setGraphIsLoading(v)}`

Result:

- AppShell now tracks graph loading status without changing loading UI.

## Step 5: Canvas Input Safety Hardening

Files changed:

1. `src/components/Sidebar.tsx`
2. `src/screens/AppShell.tsx`

Changes:

1. Added stable sidebar root marker:
   - `data-sidebar-root="1"`
2. Added wheel capture shielding at sidebar root:
   - `onWheelCapture` stopPropagation
3. Added stable main screen marker in shell:
   - `data-main-screen-root="1"`
4. Kept sibling layout model (sidebar and graph subtree separated).

Result:

- Stronger guarantee that sidebar interaction does not leak into graph input path.

## Step 6: Disable Sidebar During Graph Loading/Error

File changed:

1. `src/screens/AppShell.tsx`

Changes:

1. Added rule:
   - `sidebarDisabled = screen === 'graph' && graphIsLoading`
2. Wired prop:
   - `<Sidebar disabled={sidebarDisabled} ... />`
3. Left all loading/error surfaces untouched.

Result:

- Sidebar remains visible but non-interactable during loading/error states.

## 4. Interfaces and Contracts Added

## Sidebar contract (`src/components/Sidebar.tsx`)

1. Existing:
   - `isExpanded: boolean`
   - `onToggle: () => void`
2. Added:
   - `disabled?: boolean`

Behavior:

1. Disabled state controls root `pointerEvents`.
2. Root stops pointer and wheel propagation for graph safety.

## Graph to shell loading contract

`src/playground/GraphPhysicsPlayground.tsx`:

1. Added optional callback prop:
   - `onLoadingStateChange?: (isLoading: boolean) => void`
2. Callback source of truth:
   - same boolean used for loading-screen branch.

`src/screens/AppShell.tsx`:

1. Stores `graphIsLoading`.
2. Uses it to disable sidebar on graph loading/error.

## 5. File Change Inventory (Steps 1 to 6)

1. `src/screens/AppShell.tsx`
2. `src/screens/EnterPrompt.tsx`
3. `src/components/Sidebar.tsx`
4. `src/playground/GraphPhysicsPlayground.tsx`
5. `docs/report_2026_02_09_sidebar_persistence_step1.md` (iterative worklog updates)
6. `docs/report_2026_02_09_sidebar_persistence_steps_1_to_6_detailed.md` (this consolidated report)

## 6. Regression Constraints Preserved

1. `LoadingScreen` component UI and message path unchanged.
2. Graph loading decision path preserved, only unified/forwarded.
3. No new overlay systems introduced.
4. No graph physics/canvas behavior redesign performed.
5. Sidebar display screen rules unchanged after step 1:
   - prompt + graph only.

## 7. Verification Performed

Build verification:

1. `npm run build` passed after each implementation stage and after step 6 finalization.

Manual behavior checklist covered in implementation flow:

1. Sidebar visible on prompt and graph.
2. Sidebar hidden on welcome screens.
3. Prompt layout not occluded by left rail.
4. Sidebar non-interactable during graph loading/error.
5. Sidebar re-enabled when graph loading/error clears.
6. Loading/error surface unchanged.
7. Sidebar root shielding and sibling layout enforce canvas input safety.

## 8. Known Follow-up Surface

Potential next-step hardening areas (not part of steps 1-6):

1. Add targeted runtime test hooks for sidebar disabled transition timing.
2. Add explicit integration tests for wheel isolation over sidebar vs graph area.
3. Normalize existing non-ASCII artifacts in legacy comments to align with ASCII doctrine.

