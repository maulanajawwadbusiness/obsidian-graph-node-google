# Welcome2 Semantic Boundary Pause Fix Report

Date: 2026-02-11

## Scope
- Relocate semantic cadence pauses from letter indices to boundary indices in `src/screens/welcome2Timeline.ts`.
- Keep mechanical cadence and event-loop contract unchanged.

## What Changed
- Added helper `isBoundaryChar(ch)` to define boundary chars:
  - space, newline, and punctuation `.,?!;:`
- Added helper `buildNextBoundaryIndex(renderChars)`:
  - right-to-left pass that stores nearest boundary at or after each index.
- In `buildWelcome2Timeline(...)`:
  - added `nextBoundaryIndex` precompute immediately after `renderChars` build.
  - refactored semantic word-end allocation:
    - removed split distribution on last two letters.
    - now attaches full `wordEndPauseMs` and `heavyWordEndExtraPauseMs` to one boundary index.
    - fallback remains `renderChars.length - 1` when no boundary exists.
  - refactored sentence landing allocation:
    - removed tail-char distribution before punctuation.
    - now attaches full `sentenceLandingExtraPauseMs` directly to punctuation index.
- Removed now-unused `distributePause(...)` helper.

## Boundary Attachment Law (Now)
- Semantic pauses are added to `semanticPauseByIndex` only at:
  - following space, punctuation, or newline boundary
  - or final-char fallback if no boundary exists.
- Main event loop still does:
  - `event.pauseAfterMs = mechanicalPause + semanticPauseByIndex[i]`
  - no structural changes to event timing pipeline.

## Timing Sample (Before vs After)
Sample focus: heavy word `intuitive` followed by a space in the EN manifesto.
Cadence defaults:
- `baseCharMs=42`
- `spaceMs=14`
- `wordEndPauseMs=27`
- `heavyWordEndExtraPauseMs=135`

Previous allocation law (letter split):
- total semantic on word end = 162 ms
- split to prev+end chars at 15/85:
  - prev letter gets +24 ms
  - last letter gets +138 ms
- observed deltas near word end (approx):
  - intra-word letters: 42, 42, 42
  - second-last letter: 66
  - last letter: 180
  - following space: 14

New boundary allocation law:
- full +162 ms attached to boundary (space)
- observed deltas near word end (approx):
  - intra-word letters: 42, 42, 42, 42, 42
  - following space boundary: 176

Result:
- intra-word micro-stutter removed from last letters.
- phrase breathing preserved at boundary.

## Validation
- `npm run build` passed.
- Static checks confirmed:
  - no semantic writes to `prevIndex` or word-end letter index for split allocation.
  - sentence landing uses punctuation indices only.
  - `BuiltTimeline` output contract unchanged.

## Manual Feel Test Note
- Windows Chrome 100 percent visual feel test cannot be executed in this CLI-only environment.
- Code-level relocation is complete and aligned to the requested law.
