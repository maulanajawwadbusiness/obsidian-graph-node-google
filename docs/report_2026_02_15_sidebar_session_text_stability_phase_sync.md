# Report: 2026-02-15 Sidebar Session Text Stability and Phase Sync

## 1. Goal

Stabilize saved session row text during sidebar expand so it no longer appears to rewrite or relayout frame-by-frame. Keep the motion premium and synchronized with the existing smoothbutter expand/collapse choreography.

## 2. Problem Observed

During sidebar expand, session titles in "Your Interfaces" appeared to rewrite themselves.

Root cause:
- Session title style allowed multiline wrapping (`whiteSpace: normal` + `wordBreak: break-word`).
- Sidebar width animates continuously during expand.
- Text wrapping recomputes each frame as width changes, creating a perceived rewrite effect.

## 3. Scope

Changed:
- `src/components/Sidebar.tsx`

Not changed:
- AppShell sidebar state ownership (`isSidebarExpanded`)
- Graph pane geometry contract
- Layering/z-index contracts
- Backend code/routes

## 4. Implementation

### 4.1 Session text layout hard stabilization

In `src/components/Sidebar.tsx`:
- Updated `INTERFACE_TEXT_STYLE` to single-line stable rendering:
  - `display: block`
  - `whiteSpace: nowrap`
  - kept `overflow: hidden` + `textOverflow: ellipsis`
  - removed `wordBreak: break-word`
  - added stable rhythm (`minHeight: 18px`, `lineHeight: 18px`)

Effect:
- Title no longer re-wraps while width animates.
- Vertical row rhythm remains stable.

### 4.2 Finishing polish: phase-locked session title readability

Added phase-aware title visibility:
- Derived gate: `shouldShowSessionTitles = isExpanded && motionPhase === 'expanded'`.
- New `sessionTitleRevealStyle`:
  - hidden during expanding/collapsing
  - shown in settled expanded phase
  - short reveal transition (`84ms`) with slight `translateX` settle offset
  - reduced-motion fallback: no transition

Applied only to non-rename title text path:
- session row text span now uses `{ ...INTERFACE_TEXT_STYLE, ...sessionTitleRevealStyle }`.
- rename input path remains untouched and fully interactive.

Effect:
- During width interpolation, the row structure stays stable without text rewrite perception.
- Readable title appears only after motion settles, giving premium synchronized finish.

### 4.3 Motion-phase hover conflict hardening for rows

Extended existing in-motion hover suppression to session rows:
- Row `onMouseEnter` ignored while motion phase is active.
- Row ellipsis `onMouseEnter` ignored while motion phase is active.
- During motion phase start, transient row hover states are reset:
  - `setHoveredInterfaceId(null)`
  - `setHoveredEllipsisRowId(null)`

Effect:
- Prevents hover flash/noise while sidebar is animating.
- Keeps row visuals consistent with the locked motion choreography.

## 5. Invariants Preserved

- Panels and overlays still own input events; no pointer or wheel shielding was removed.
- `isSidebarExpanded` remains the single source of truth.
- Existing phase model (`collapsed`, `expanding`, `expanded`, `collapsing`) remains authoritative.
- No z-index additions on graph layout shells.
- Reduced-motion path remains deterministic.

## 6. Risks and Tradeoffs

- Titles are now intentionally single-line in sidebar rows, so long names truncate earlier.
- During expand, row title readability is intentionally deferred until settled expanded phase.

These are intentional to maximize perceptual stability and premium sync.

## 7. Verification

Manual checks to run:
1. Expand/collapse with long session titles; verify no rewrite effect during motion.
2. Rapid toggle stress; verify no hover flash in rows while moving.
3. Rename flow; verify input behavior is unchanged.
4. Reduced-motion enabled; verify immediate non-animated behavior.

Static check:
- `npx tsc --noEmit --pretty false`

Note:
- Existing repo has a known pre-existing backend type mismatch in `src/server/src/server/bootstrap.ts` unrelated to this sidebar work; this report preserves that as an external blocker if it appears.

## 8. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_sidebar_session_text_stability_phase_sync.md`
