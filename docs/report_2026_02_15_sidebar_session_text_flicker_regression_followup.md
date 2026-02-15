# Report: 2026-02-15 Sidebar Session Text Flicker Regression Follow-up

## 1. Goal

Address a regression where a previous flicker fix made session row title flicker appear worse during sidebar expand.

## 2. Regression Cause

After commit `11bee95`, session title text was rendered with `INTERFACE_TEXT_STYLE` only and no title visibility gate.

That made titles visible throughout width interpolation. Since row title is ellipsized and available width changes every frame during expand, clipping boundary moved continuously and the symptom became more noticeable.

## 3. Scope

Changed:
- `src/components/Sidebar.tsx`

Added:
- `docs/report_2026_02_15_sidebar_session_text_flicker_regression_followup.md`

Not changed:
- AppShell sidebar ownership
- Graph layout structure and overlay layering
- Backend routes and server behavior

## 4. Implementation

### 4.1 Restored title-level visibility gate with settle-only policy

In `Sidebar.tsx`:
- Added `shouldShowSessionTitles = motionPhase === 'expanded'`.

Effect:
- Session titles stay hidden while width is actively interpolating (`expanding` and `collapsing`).
- Titles appear only after motion settles.

### 4.2 Opacity-only reveal (no translate)

In `Sidebar.tsx`:
- Added `SESSION_TITLE_REVEAL_TRANSITION` as opacity-only transition.
- Added `sessionTitleRevealStyle` with:
  - phase-gated opacity
  - opacity-only transition
  - pointer-events gating

Effect:
- No horizontal text translation on reveal.
- Avoids added positional motion on top of width interpolation.

### 4.3 Kept pre-paint phase sync hardening

`motionPhase` transition hook remains `React.useLayoutEffect`.

Effect:
- Keeps phase timing deterministic before paint and avoids post-commit phase lag artifacts.

## 5. Invariants Preserved

- `isSidebarExpanded` remains single source of truth.
- Input shielding and pointer propagation stops remain intact.
- Session row text lane remains single-line ellipsis with stable line metrics.
- Existing sidebar geometry timing contract remains unchanged.

## 6. Verification

Command run:
- `npx tsc --noEmit --pretty false`

Result:
- Fails on known pre-existing backend mismatch:
  - `src/server/src/server/bootstrap.ts(110,5)`

Manual checks to run:
1. Expand with long titles: no in-flight title jitter.
2. Rapid open and close stress: no brief title misplacement.
3. Rename row behavior unchanged.
4. Reduced-motion path remains deterministic.

## 7. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_sidebar_session_text_flicker_regression_followup.md`
