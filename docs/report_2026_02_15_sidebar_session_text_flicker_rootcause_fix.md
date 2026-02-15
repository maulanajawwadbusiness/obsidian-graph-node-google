# Report: 2026-02-15 Sidebar Session Text Flicker Root-Cause Fix

## 1. Goal

Remove session row title flicker and jump during sidebar expand while preserving existing smooth sidebar geometry motion.

## 2. Problem Summary

Observed behavior:
- During expand, session title text in "Your Interfaces" appeared to jump and flicker briefly before settling.

Root-cause chain:
1. Sidebar width was animating while session title also had its own opacity plus translate reveal.
2. Session title lane was ellipsized, so clipping boundary changed while width moved.
3. Text had dual choreography (section-level plus per-title), which produced visible phase mismatch.
4. Motion phase state was updated in `useEffect`, allowing one-paint lag risk after `isExpanded` changes.

## 3. Scope

Changed:
- `src/components/Sidebar.tsx`

Added:
- `docs/report_2026_02_15_sidebar_session_text_flicker_rootcause_fix.md`

Not changed:
- AppShell sidebar state ownership
- Graph layout ownership and z-index layering contracts
- Backend routes and server code

## 4. Implementation

### 4.1 Removed per-title reveal choreography

In `Sidebar.tsx`:
- Removed session-specific reveal style composition from interface title text.
- Session row title now renders with stable lane style only:
  - from `{ ...INTERFACE_TEXT_STYLE, ...sessionTitleRevealStyle }`
  - to `INTERFACE_TEXT_STYLE`

Effect:
- Session titles now follow section-level sidebar content choreography only.
- Eliminates dual-animation conflict on title text.

### 4.2 Removed dead session title offset token

In `Sidebar.tsx`:
- Removed `SESSION_TEXT_HIDDEN_OFFSET_PX` since session title reveal transform was removed.

Effect:
- Keeps style tokens clean and avoids stale reveal dependencies.

### 4.3 Hardened phase timing to pre-paint

In `Sidebar.tsx`:
- Replaced motion phase transition hook from `React.useEffect` to `React.useLayoutEffect` for `isExpanded` phase synchronization.
- Preserved existing settle timing and reduced-motion behavior.

Effect:
- Prevents post-commit first-frame phase lag from leaking into visible motion state.

## 5. Invariants Preserved

- `isSidebarExpanded` remains the single source of truth from AppShell.
- Sidebar width transition contract remains unchanged.
- Pointer and wheel shielding remains unchanged.
- Session text lane still uses single-line truncation (`nowrap`, `ellipsis`, stable line-height).

## 6. Verification

Command run:
- `npx tsc --noEmit --pretty false`

Result:
- Fails on known pre-existing backend mismatch:
  - `src/server/src/server/bootstrap.ts(110,5)`
- No new sidebar-specific type error observed before this blocker.

Manual checks to run in app:
1. Expand sidebar with short and long session titles: no jump/flicker.
2. Rapid expand/collapse toggle stress: no brief text misplacement.
3. Rename flow unchanged and still interactive.
4. Reduced-motion path remains deterministic.

## 7. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_sidebar_session_text_flicker_rootcause_fix.md`
