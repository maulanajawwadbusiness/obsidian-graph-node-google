# Report: Sidebar Internal Phase-Lock Sync Pass (2026-02-15)

## 1) Goal

Make sidebar internal elements move in perfect sync with sidebar geometry expand and collapse.
Preserve premium smooth feel while keeping movement sharp and straight.

## 2) Scope

Files changed:
- `src/components/Sidebar.tsx`

Docs added:
- `docs/report_2026_02_15_sidebar_internal_phase_lock.md`

No backend behavior changed.
No AppShell state ownership changed.
No graph pane layout contract changed.

## 3) What Was Wrong Before

1. Internal elements were coordinated by `showExpandedContent` timing, not explicit motion phases.
2. Expanded-only sections were mount-gated and could still feel step-like relative to shell width motion.
3. Bottom avatar row used non-animatable branch behavior (`fit-content` swap), causing layout snap.
4. Hover effects could conflict visually during active motion.

## 4) Implementation

### 4.1 Added explicit motion phase model

In `Sidebar.tsx`, added `SidebarMotionPhase`:
- `collapsed`
- `expanding`
- `expanded`
- `collapsing`

Added `motionPhase` state and deterministic settle timers tied to geometry durations:
- expand settle: `SIDEBAR_EXPAND_DURATION_MS`
- collapse settle: `SIDEBAR_COLLAPSE_DURATION_MS`

Reduced-motion behavior:
- immediate phase settle to `expanded` or `collapsed`
- no phase animation delay path

### 4.2 Replaced content gating with phase-aware mount policy

Introduced:
- `shouldMountExpandedContent = isExpanded || motionPhase !== 'collapsed'`

Behavior:
- expand path mounts internal expanded content immediately
- collapse path keeps content mounted through collapse phase, then allows unmount only in settled collapsed phase

Applied this policy to:
- close button content region
- nav label content slots
- interfaces section shell
- document viewer label
- avatar name

### 4.3 Layout desnap improvements

Bottom section now uses animatable padding transitions instead of abrupt branch switch:
- `padding-left`
- `padding-right`

Avatar row no longer switches to `fit-content`:
- width now animates between `32px` and `calc(100% - 10px)`
- `margin-right` animates between `0px` and `10px`

This removes branch-based jump and keeps bottom region aligned with shell motion.

### 4.4 Hover conflict suppression during motion

During `expanding` and `collapsing` phases:
- transient hover states are reset
- key hover enters are ignored for moving internals

This avoids hover color/opacity effects fighting the primary motion choreography.

### 4.5 Contracts preserved

1. Sidebar geometry still follows `isSidebarExpanded` owner in AppShell.
2. Popup menus remain outside transformed rail path and keep fixed anchoring behavior.
3. Pointer and wheel shielding behavior remains in place.
4. No z-index contract changes introduced.

## 5) Verification

Command run:
- `npx tsc --noEmit --pretty false`

Result:
- Same pre-existing backend type error remains:
  - `src/server/src/server/bootstrap.ts(110,5)`
- No new Sidebar-type errors were reported before that known blocker.

## 6) Expected UX Result

1. Internal sidebar elements now follow a deterministic phase model.
2. Expanded content enters and exits in sync with shell motion timeline.
3. Bottom section no longer snaps between structural modes.
4. Motion reads as premium and coherent, without internal pop steps.
