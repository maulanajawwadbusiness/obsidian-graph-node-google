# Report: Sidebar Premium Motion Mini Runs (2026-02-15)

## 1) Goal

Make sidebar expand and collapse feel premium smoothbutter while staying sharp and straight.
Keep graph screen geometry sync, panel shielding, and layering contracts intact.

## 2) Scope

Files changed:
- `src/screens/appshell/appShellStyles.ts`
- `src/components/Sidebar.tsx`
- `src/screens/appshell/render/GraphScreenShell.tsx`
- `src/screens/AppShell.tsx`

No backend behavior changed.
No route or screen-flow ownership changed.

## 3) Mini Run Execution Summary

### Run 1: Baseline and token seam check
- Confirmed sidebar geometry and graph structural pane are both driven by `isSidebarExpanded`.
- Confirmed existing motion was single-profile width + single-profile content + single-profile dim.

### Run 2: Direction-aware geometry tokens
- Added asymmetric geometry tokens:
  - expand: 164ms, `cubic-bezier(0.20, 0.00, 0.00, 1.00)`
  - collapse: 132ms, `cubic-bezier(0.40, 0.00, 1.00, 1.00)`
- Added `getSidebarWidthTransitionCss(expanded)`.

### Run 3: Overlay + graph pane sync
- Wired `Sidebar.tsx` and `GraphScreenShell.tsx` to use `getSidebarWidthTransitionCss(isExpanded)`.
- Preserved width endpoints:
  - collapsed: `35px`
  - expanded: `max(10vw, 200px)`

### Run 4: Hybrid visual rail
- Added subtle transform assist for sidebar content rail:
  - expand: `translateX(-2px) -> 0` in 120ms
  - collapse: `0 -> translateX(-2px)` in 96ms
- Kept width as geometry truth. No scale. No bounce.
- Kept menus outside transform wrappers to avoid fixed-position anchoring side effects.

### Run 5: Content phase tightening
- Replaced single content transition with asymmetric content transitions:
  - expand: 108ms with 16ms delay
  - collapse: 88ms with 0ms delay
- Updated unmount delay for expanded-only content to collapse total duration.

### Run 6: Dimming coherence
- Added direction-aware dim transition helper:
  - expand dim aligned to expand geometry
  - collapse undim aligned to collapse geometry
- `AppShell` now uses `getNonSidebarDimTransitionCss(isSidebarExpanded)`.

### Run 7: Reduced motion parity
- New transition helpers are bypassed with `prefers-reduced-motion` and set to `none`.
- Reduced-motion behavior remains deterministic.

### Run 8: Contract lock check
- Preserved invariants:
  1. Single source of truth remains `isSidebarExpanded` in `AppShell`.
  2. Graph structural pane continues to mirror sidebar width state.
  3. Overlay/sidebar shielding remains intact (`pointer` and `wheel` stopPropagation patterns retained).
  4. No new z-index layers were introduced in `GraphScreenShell`.

## 4) Verification

Commands run:
- `npm run build`
- `npx tsc --noEmit --pretty false`

Result:
- Same pre-existing server type error remains:
  - `src/server/src/server/bootstrap.ts(110,5)`
- No new sidebar-motion-specific type errors were introduced before that known blocker.

## 5) Tuning Knobs (Current)

Primary knobs now in `appShellStyles.ts`:
- geometry: `SIDEBAR_EXPAND_DURATION_MS`, `SIDEBAR_COLLAPSE_DURATION_MS`
- geometry easing: `SIDEBAR_EXPAND_TIMING_FUNCTION`, `SIDEBAR_COLLAPSE_TIMING_FUNCTION`
- content phase: `SIDEBAR_CONTENT_EXPAND_DURATION_MS`, `SIDEBAR_CONTENT_EXPAND_DELAY_MS`, `SIDEBAR_CONTENT_COLLAPSE_DURATION_MS`
- visual rail: `SIDEBAR_VISUAL_RAIL_HIDDEN_OFFSET_PX`, `SIDEBAR_VISUAL_RAIL_EXPAND_DURATION_MS`, `SIDEBAR_VISUAL_RAIL_COLLAPSE_DURATION_MS`
