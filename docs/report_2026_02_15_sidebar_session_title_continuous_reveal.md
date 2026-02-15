# Report: 2026-02-15 Sidebar Session Title Continuous Reveal

## 1. Goal

Fix session title reveal choreography so text appears in continuous sync with sidebar expansion, instead of appearing late and sudden at settle.

## 2. Regression Description

Observed behavior after previous run:
- Session titles were fully hidden until `motionPhase === 'expanded'`.
- Titles only became visible after width expansion settled.
- A short local reveal timing then made text appear as a late jump or slap.

User intent:
- Fade should begin shortly after expand starts.
- Text must feel continuously attached to smoothbutter sidebar movement.
- Text must remain visually stable (no multiline rewrite/reflow effect).

## 3. Root Cause

In `src/components/Sidebar.tsx`:
- `shouldShowSessionTitles` was `isExpanded && motionPhase === 'expanded'`.
- That settle-only gate prevented any in-flight visibility during `expanding`.
- `sessionTitleRevealStyle` used a local short transition profile (`84ms`) instead of shared sidebar content transition timing.

This made title motion disconnected from existing content choreography used by other expanded labels.

## 4. Implementation

### 4.1 Phase gate change (continuous during expand)

Changed title visibility gate:
- from: `isExpanded && motionPhase === 'expanded'`
- to: `motionPhase === 'expanding' || motionPhase === 'expanded'`

Effect:
- Titles are allowed to reveal during expansion rather than waiting for settle.
- Collapse remains sharp because titles are hidden during collapsing/collapsed phases.

### 4.2 Transition unification (single motion truth)

Changed session title transition source:
- from local constant (`SESSION_TITLE_REVEAL_TRANSITION`)
- to shared `contentTransitionCss` already used by sidebar expanded content.

Removed local transition constant.

Effect:
- Session titles now follow the same expand/collapse delay, duration, and easing profile as existing internal content.
- Reveal starts shortly after expand start, producing continuous premium feel.

### 4.3 Stability baseline preserved

Kept prior anti-reflow layout stabilization:
- title text remains single-line ellipsis (`nowrap`, hidden overflow, ellipsis)
- fixed line rhythm (`lineHeight`, `minHeight`) retained.

Effect:
- Continuous fade-in without reintroducing frame-by-frame wrapping rewrite.

## 5. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_sidebar_session_title_continuous_reveal.md`

## 6. Verification

Static check:
- `npx tsc --noEmit --pretty false`

Expected known blocker:
- pre-existing backend type mismatch in `src/server/src/server/bootstrap.ts` (Midtrans request type) may still fail full type-check.
- No new sidebar-specific type errors expected.

Manual verification checklist:
1. Expand sidebar on graph screen and prompt screen.
2. Confirm session titles start fading shortly after expand begins.
3. Confirm no late jump/slap at settle.
4. Confirm no multiline reflow rewrite during expansion.
5. Rapid toggle stress for phase-race sanity.
6. Reduced-motion behavior remains deterministic.

## 7. Invariants Preserved

- `isSidebarExpanded` remains single source of truth.
- Input shielding contracts unchanged.
- No z-index/layout layering changes.
- Rename/input/menu flows remain functionally unchanged.
