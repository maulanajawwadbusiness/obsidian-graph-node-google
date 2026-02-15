# Report: Sidebar Smoothbutter Motion Pass (2026-02-15)

## 1) Goal

Improve sidebar collapse/expand feel so motion is:

- smooth to the eye,
- sharp in response,
- coherent between overlay Sidebar and graph structural sidebar column,
- without changing sidebar feature behavior or screen-flow behavior.

This pass focused on motion/choreography only.


## 2) Scope and Files Touched

Implemented changes in:

- `src/screens/appshell/appShellStyles.ts`
- `src/screens/AppShell.tsx`
- `src/screens/appshell/render/GraphScreenShell.tsx`
- `src/components/Sidebar.tsx`

No backend logic touched.
No screen routing changes.
No new sidebar state source introduced.


## 3) Root Cause Findings Before Patch

The cheap feeling came from choreography mismatch:

1. Width animation was smooth, but expanded-only content hard mounted/unmounted via `isExpanded && ...`.
2. Non-sidebar dimming switched instantly with no transition.
3. Geometry used `width` plus `min-width` transition, which created less consistent perceived motion with `10vw` and min `200px`.
4. Overlay sidebar and graph structural column were not fully staged as one visual system.


## 4) Implementation Details

### 4.1 Shared geometry + timing contract (`appShellStyles.ts`)

Added/updated tokens:

- `SIDEBAR_EXPANDED_RESOLVED_WIDTH_CSS = max(10vw, 200px)`
- `SIDEBAR_TRANSITION_DURATION_MS = 176`
- `SIDEBAR_TRANSITION_TIMING_FUNCTION = cubic-bezier(0.22, 0.0, 0.0, 1)`
- `SIDEBAR_TRANSITION_CSS = width ...` (width-only transition)
- `SIDEBAR_CONTENT_TRANSITION_DURATION_MS = 128`
- `SIDEBAR_CONTENT_TRANSITION_CSS` for content fade+slide (`opacity` + `transform`)
- `NON_SIDEBAR_DIMMED_FILTER = brightness(0.8)`
- `NON_SIDEBAR_BASE_FILTER = brightness(1)`
- `NON_SIDEBAR_DIM_TRANSITION_CSS = filter ...`

Why:

- Use one resolved expanded width expression so geometry moves consistently.
- Animate one geometry property (`width`) to reduce weird interpolation behavior.
- Share motion tokens across overlay and structural pane.


### 4.2 AppShell dimming choreography (`AppShell.tsx`)

Changed non-sidebar layer style application from hard toggle to animated filter:

- before: apply/remove `NON_SIDEBAR_DIMMED_STYLE` abruptly,
- after: always set `filter` (`brightness(1)` or `brightness(0.8)`) and animate via `NON_SIDEBAR_DIM_TRANSITION_CSS`.

Why:

- Prevent brightness snap during sidebar toggle.


### 4.3 Graph structural column motion alignment (`GraphScreenShell.tsx`)

Changed graph left structural column width logic:

- before: expanded width and min-width split tokens, transition included `width` and `min-width`,
- after: width uses `SIDEBAR_EXPANDED_RESOLVED_WIDTH_CSS` and transition is width-only.

Also:

- retained `flexShrink: 0` and `height: 100%`,
- added `willChange: 'width'` in normal motion mode.

Why:

- Keep graph pane resize in sync with overlay sidebar in one visual rhythm.


### 4.4 Sidebar content staging to remove pop (`Sidebar.tsx`)

Added local visual stage state:

- `showExpandedContent` (derived from `isExpanded` with close-delay equal to content transition duration).

Behavior:

- expand: content mounts immediately and fades/slides in,
- collapse: content fades/slides out first, then unmounts.

Applied staged rendering to expanded-only regions:

- close button row control,
- "Your Interfaces" section,
- nav labels (via `NavItem`),
- document viewer label,
- avatar name.

Added:

- `expandedContentStyle` (opacity + small x-translate + transition + pointer-events gating),
- `overflow: hidden` on sidebar root and nav item rows to avoid label bleed during collapse,
- `willChange: 'width'` on sidebar root in normal motion mode.

Why:

- Remove hard visual pops while preserving existing interaction flow.


### 4.5 Reduced motion support

Added `prefers-reduced-motion` handling in:

- `AppShell.tsx`
- `GraphScreenShell.tsx`
- `Sidebar.tsx`

When enabled:

- geometry/content/dimming transitions are set to `none`.

Why:

- Keep motion accessibility-safe and deterministic.


## 5) Invariants Preserved

1. Single source of truth remains `isSidebarExpanded` in `AppShell`.
2. Overlay Sidebar still owns input shielding (`pointer`/`wheel` stopPropagation contract unchanged).
3. Sidebar behavior and controls remain the same (open/close triggers, menus, actions).
4. Non-graph screens still use overlay sidebar behavior.
5. Graph runtime remains container-relative and fills graph pane.
6. No z-index contract changes introduced for overlays/modals.


## 6) Build / Verification

Command run:

- `npm run build`

Observed result:

- Same pre-existing backend TypeScript error remains:
  - `src/server/src/server/bootstrap.ts(110,5)` mismatch in request function type.

No new build errors were introduced from the sidebar motion files touched in this pass.


## 7) Before vs After Summary

Before:

- smooth width but abrupt content pop,
- abrupt dimming snap,
- split width/min-width interpolation could feel less intentional.

After:

- width motion is shared and consistent across overlay and graph structural column,
- dimming transitions with sidebar movement,
- expanded content reveals/hides in short staged fade/slide instead of abrupt pop,
- motion remains short and decisive.


## 8) Remaining Tuning Knobs (if further feel tuning is needed)

Primary knobs:

- `SIDEBAR_TRANSITION_DURATION_MS`
- `SIDEBAR_TRANSITION_TIMING_FUNCTION`
- `SIDEBAR_CONTENT_TRANSITION_DURATION_MS`
- content offset constant in Sidebar (`EXPANDED_CONTENT_HIDDEN_OFFSET_PX`)

Suggested policy:

- keep geometry <= ~200ms,
- keep content phase shorter than geometry,
- avoid spring/bounce behaviors to preserve sharpness.
