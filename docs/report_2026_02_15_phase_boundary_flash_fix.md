# Report: 2026-02-15 Phase Boundary Flash Fix

## 1. Goal

Remove the 1-frame phase-boundary flash on sidebar session title while preserving continuous smoothbutter choreography during expand and collapse.

## 2. Before vs After

Before:
- `isExpanded` prop changed immediately and width transition started.
- `motionPhase` sync ran in `useEffect`.
- `useEffect` can allow the first paint after toggle to use stale phase state.
- Session title reveal gate is phase-derived, so stale phase could produce a one-frame style mismatch.

After:
- `motionPhase` sync runs in an isomorphic layout effect (`useIsoLayoutEffect`).
- Active phase (`expanding` or `collapsing`) is committed in pre-paint lifecycle.
- Settle timer behavior is unchanged.
- Continuous reveal policy is unchanged (`expanding || expanded`).

## 3. Evidence Focus

Target mismatch signature for this fix:
- on expand boundary, a render or paint where:
  - `isExpanded=1`
  - `motionPhase=collapsed`
  - `shouldShowSessionTitles=0`
- then immediately followed by:
  - `motionPhase=expanding`
  - `shouldShowSessionTitles=1`

That signature is exactly what can produce a 1-frame flash/jump.

Instrumentation support in code:
- `[sidebar-phase]` toggle probe now logs first 3 renders and first 3 painted frames per toggle.
- Logged fields include:
  - `isExpanded`, `motionPhase`, `showTitles`, `transition`
  - title `opacity`, `transform`, `clientWidth`, `scrollWidth`
  - sidebar width and hover ids

## 4. Implementation

File changed:
- `src/components/Sidebar.tsx`

Changes:
1. Added helper:
   - `useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect`
2. Replaced phase sync hook:
   - from `React.useEffect(...)`
   - to `useIsoLayoutEffect(...)`
3. Preserved existing timing:
   - expand settle: `SIDEBAR_EXPAND_DURATION_MS`
   - collapse settle: `SIDEBAR_COLLAPSE_DURATION_MS`
4. No changes to pointer/wheel shielding handlers.

## 5. Why This Prevents Stale-Phase Paint

`useLayoutEffect` runs after commit but before paint. By setting active motion phase there, the browser does not paint a frame with stale collapsed phase after an expand toggle. That removes the phase-boundary window where reveal gates can flip one frame late.

## 6. Verification

Static check:
- `npx tsc --noEmit --pretty false`

Result:
- same pre-existing backend mismatch:
  - `src/server/src/server/bootstrap.ts(110,5)`

Manual matrix to run in-app:
1. Expand/collapse repeatedly with mouse not over sidebar.
2. Expand with mouse parked over a session row.
3. Long title near ellipsis cutoff.
4. Zoom 100 percent and 125 percent.

Expected:
- no one-frame phase mismatch flash at toggle boundary.

## 7. Commits in This Fix Block

1. `cee58a8` `chore(sidebar): tighten phase-boundary toggle probes`
2. `b7de1e2` `fix(sidebar): sync motionPhase pre-paint with iso layout effect`

## 8. Invariants Preserved

- Input shielding (`stopPropagation` for pointer and wheel on sidebar/row controls) preserved.
- Session titles remain continuously choreographed during expansion (not hidden until settled).
- Sidebar ownership and layering contracts unchanged.
