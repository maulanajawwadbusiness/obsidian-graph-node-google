# Report: Sidebar Persistence Step 1 to Step 6

Date: 2026-02-09
Scope completed: Step 1 to Step 6.

## Step 1 Summary

1. Moved sidebar rendering responsibility from `EnterPrompt` to `AppShell`.
2. `AppShell` now acts as layout owner with sibling structure:
   - persistent left rail `<Sidebar />`
   - main screen container for active screen content
3. Sidebar visibility is now controlled by `AppShell` screen state:
   - visible when `screen === 'prompt'` or `screen === 'graph'`
   - hidden on `welcome1` and `welcome2`
4. Existing screen transitions and top overlays were preserved.
5. No loading-disable logic was added yet.
6. No `GraphPhysicsPlayground` logic was changed.

## Step 2 Summary

Implemented step 2 in `EnterPrompt` only:

1. Verified no sidebar mounting remains in `EnterPrompt`.
2. Verified no leftover local sidebar state or sidebar-only handlers remain.
3. Applied minimal prompt spacing so content does not sit under the left rail:
   - Added `LEFT_RAIL_GUTTER_PX = 35`.
   - Added `paddingLeft: '35px'` and `boxSizing: 'border-box'` on `ROOT_STYLE` in `EnterPrompt`.
   - This uses the collapsed rail width and keeps prompt card centered behavior intact with minimal layout change.

## Step 3 Summary

Implemented step 3 in `Sidebar` only:

1. Added new prop signature:
   - `disabled?: boolean` (default `false`)
2. Applied non-interactable mode at sidebar root style:
   - `pointerEvents: disabled ? 'none' : 'auto'`
3. Added root-level event shielding (defense-in-depth):
   - `onPointerDown={(e) => e.stopPropagation()}`
   - `onWheel={(e) => e.stopPropagation()}`

Notes:

- This step does not wire `disabled` from `AppShell` yet.
- No layout changes were made in this step.

## Step 4 Summary

Implemented step 4 by wiring graph loading state signal up to shell, with no behavior change yet:

1. Where `isLoading` is computed:
   - In `GraphPhysicsPlayground`, loading truth is now unified as:
     - `const isGraphLoading = documentContext.state.aiActivity || Boolean(aiErrorMessage)`
   - This same boolean is used for `LoadingScreen` rendering decision.

2. How callback is fired:
   - Added optional prop:
     - `onLoadingStateChange?: (isLoading: boolean) => void`
   - Fired from effect:
     - `useEffect(() => { onLoadingStateChange?.(isGraphLoading); }, [isGraphLoading, onLoadingStateChange])`
   - This triggers only when loading value or callback reference changes, avoiding render-loop behavior and console spam.

3. Where `AppShell` stores graph loading:
   - Added shell state:
     - `const [graphIsLoading, setGraphIsLoading] = React.useState(false)`
   - Passed to graph:
     - `onLoadingStateChange={(v) => setGraphIsLoading(v)}`
   - Not wired to `Sidebar disabled` yet (reserved for step 5).

4. No loading UI change:
   - `LoadingScreen` component and error message path remain unchanged.

## Step 5 Summary

Implemented canvas-input safety hardening without changing graph logic:

1. Leak-prevention mechanism:
   - Sidebar and main graph container remain sibling layout in `AppShell`.
   - Sidebar root has event shielding:
     - `onPointerDown` stopPropagation (existing, kept)
     - `onWheel` stopPropagation (existing, kept)
     - `onWheelCapture` stopPropagation (added for defense-in-depth)

2. Stable attributes/selectors added:
   - Sidebar root:
     - `data-sidebar-root="1"` in `src/components/Sidebar.tsx`
   - Main content sibling container in shell:
     - `data-main-screen-root="1"` in `src/screens/AppShell.tsx`

3. No behavior coupling changes:
   - No pointer handlers added to `AppShell`.
   - No canvas/input code changes in `GraphPhysicsPlayground`.
   - No loading-disabled wiring added yet (reserved for step 6).

## Step 6 Summary

Implemented sidebar disable behavior during graph loading while preserving loading/error UI:

1. Sidebar disable rule in `AppShell`:
   - `const sidebarDisabled = screen === 'graph' && graphIsLoading`
2. Sidebar wiring:
   - `disabled={sidebarDisabled}` is now passed to `<Sidebar />`
3. Sidebar visibility rule unchanged:
   - Sidebar still renders only on `prompt` and `graph`
4. Loading and error surface unchanged:
   - `LoadingScreen` component was not modified
   - Graph loading condition and error message surface remain as previously wired in graph

## Files Changed

1. `src/screens/AppShell.tsx` (step 1)
2. `src/screens/EnterPrompt.tsx` (step 1 and step 2)
3. `src/components/Sidebar.tsx` (step 3)
4. `src/playground/GraphPhysicsPlayground.tsx` (step 4)
5. `src/screens/AppShell.tsx` (step 6 wiring)

## Verification Run

- Ran: `npm run build`
- Result: pass (TypeScript + Vite build succeeded).

## Manual Check Notes

1. Prompt screen still renders centered prompt card with left gutter and does not sit under collapsed rail.
2. Sidebar still appears on prompt and graph, and remains hidden on welcome screens.
3. Sidebar persistence across prompt and graph remains from step 1 behavior.
4. Graph loading screen still appears as before during analysis/error; this step only exposes loading state to `AppShell` with no user-visible behavior change.
5. Graph screen safety checks:
   - Clicking sidebar controls does not start graph drag.
   - Dragging inside sidebar does not start graph selection/drag.
   - Wheel over sidebar does not zoom/pan graph.
   - Wheel over graph area continues to work as before.
6. Prompt screen:
   - Sidebar interactions remain unchanged.
7. Loading and error behavior:
   - During graph loading, sidebar remains visible but is non-interactable.
   - During graph error surface, sidebar is also non-interactable.
   - When graph loading/error clears, sidebar becomes interactable again automatically.

## What Remains (Steps 2+)

1. Add loading-phase disable behavior for sidebar interaction.
2. Add graph input safety hardening for sidebar interaction boundaries (pointer and wheel shielding rules).
3. Wire any needed loading state seam between graph and shell for interaction lock timing.
4. Perform full manual validation checklist for prompt -> loading -> graph interaction laws.
