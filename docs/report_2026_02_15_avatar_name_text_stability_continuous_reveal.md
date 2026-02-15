# Report: 2026-02-15 Avatar Name Text Stability and Continuous Reveal

## 1. Goal

Fix avatar name text behavior in sidebar bottom profile row so it does not reflow/flicker during expand, and reveals in continuous sync with smoothbutter expansion.

## 2. Problem

Observed issue:
- Avatar name text flickered and appeared to reflow while sidebar expanded.

Root causes:
1. Avatar name text style lacked a stable truncation lane (no `minWidth: 0`, no ellipsis contract).
2. Avatar name horizontal positioning used a negative layout margin (`marginLeft: -13px`), which can amplify visual jitter while row width animates.
3. Avatar text reused generic expanded content style but did not have its own phase-aware reveal contract aligned with the new session-title logic.

## 3. Scope

Changed:
- `src/components/Sidebar.tsx`

Not changed:
- AppShell ownership/state
- Graph screen layout/z-index
- Backend code

## 4. Implementation

### 4.1 Avatar text lane stabilization

In `AVATAR_NAME_STYLE`:
- Added stable text-lane properties:
  - `display: block`
  - `flex: 1`
  - `minWidth: 0`
  - `minHeight: 18px`
  - `overflow: hidden`
  - `textOverflow: ellipsis`
  - `whiteSpace: nowrap`
  - `lineHeight: 18px`

Effect:
- Text remains single-line and stable while row width transitions.

### 4.2 Replace layout offset with paint offset

Replaced old negative layout margin approach with transform-based paint offset constants:
- `AVATAR_NAME_BASE_OFFSET_PX = -13`
- `AVATAR_NAME_HIDDEN_OFFSET_PX = 2`

Effect:
- Keeps desired visual alignment while avoiding layout-affecting margin jitter.

### 4.3 Avatar name phase-aware continuous reveal

Added phase gate:
- `shouldShowAvatarName = motionPhase === 'expanding' || motionPhase === 'expanded'`

Added reveal style:
- `avatarNameRevealStyle` with:
  - phase-based opacity
  - transform from hidden to baseline paint offset
  - shared transition source: `contentTransitionCss`

Applied to render path:
- avatar name now uses `{ ...AVATAR_NAME_STYLE, ...avatarNameRevealStyle }`

Effect:
- Avatar name begins reveal during expand (continuous), not late at settle.
- Collapse remains sharp by hiding during collapsing/collapsed phases.

## 5. Invariants Preserved

- Pointer/wheel shielding unchanged.
- Sidebar motion phase machine remains authoritative.
- Shared content transition contract remains the timing truth.
- No z-index changes.

## 6. Verification

Static check run:
- `npx tsc --noEmit --pretty false`

Result:
- Same pre-existing backend type mismatch remains at:
  - `src/server/src/server/bootstrap.ts(110,5)`
- No new sidebar-specific type error introduced before that blocker.

Manual checks to perform in UI:
1. Expand/collapse on graph and prompt screens.
2. Long avatar names to confirm ellipsis stability.
3. Rapid toggle stress for phase-race visual sanity.
4. Avatar menu open/close behavior during expanded state.
5. Reduced-motion mode behavior.

## 7. Files Changed

- `src/components/Sidebar.tsx`
- `docs/report_2026_02_15_avatar_name_text_stability_continuous_reveal.md`
