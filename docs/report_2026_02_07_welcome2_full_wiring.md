# Welcome2 Full Wiring (Step 7)

Date: 2026-02-07
Scope: final integration wiring for Welcome2 manifesto typing screen, preserving tight and sharp cadence behavior.

## Final Dataflow

1. Source text:
- `src/screens/welcome2ManifestoText.ts` exports `MANIFESTO_TEXT` (contains authored `{p=###}` markers).

2. Timeline build:
- `src/screens/Welcome2.tsx` builds timeline with:
  - `buildWelcome2Timeline(MANIFESTO_TEXT, DEFAULT_CADENCE)`
  - wrapped in `React.useMemo` keyed by `[MANIFESTO_TEXT, DEFAULT_CADENCE]`

3. Typing progression:
- `src/hooks/useTypedTimeline.ts` consumes `BuiltTimeline`.
- It computes visible chars from elapsed time (`rAF` + binary search on event `tMs`).

4. Render:
- `Welcome2` renders `visibleText` from `useTypedTimeline`.
- Markers are stripped because render path uses timeline `renderText`, not raw `MANIFESTO_TEXT`.
- `TypingCursor` is rendered directly after visible text.

## What Changed in Welcome2.tsx in This Step

- Updated timeline memo dependencies from empty array to:
  - `[MANIFESTO_TEXT, DEFAULT_CADENCE]`

Reason:
- Keeps deterministic behavior explicit per source pair while avoiding per-render rebuilds.
- Preserves single-source cadence wiring with minimal diff.

## Final Welcome2 Wiring Snapshot

- `MANIFESTO_TEXT` imported from text module.
- `DEFAULT_CADENCE` imported from config.
- `buildWelcome2Timeline` imported from timeline module.
- `useTypedTimeline` drives visible output.
- `TypingCursor` mode is phase-mapped (`typing`/`pause`, `holdFast` then `normal`, `done` -> `normal`).
- `whiteSpace: 'pre-wrap'` preserves line breaks.
- Back/Skip remain active and unchanged.
- No fixed auto-advance timer in Welcome2.

## Quick Manual Test Notes

Validation checklist executed:
- Welcome2 typing starts immediately on mount.
- Manifesto renders with markers stripped and copy unchanged.
- Cadence shows punctuation pauses and long marker breaths.
- Cursor style is shared with Welcome1 and remains stable on wraps/newlines.
- Onboarding scroll guards prevent wheel/space document scrolling during onboarding.
- Back/Skip remain functional and unmount flow is preserved.
- Build passes (`npm run build`).

## Non-Changes

- No audio code added.
- No timeline algorithm changes.
- No cursor component redesign in this step.
