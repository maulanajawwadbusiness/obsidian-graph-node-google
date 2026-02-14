# Welcome2 Ellipsis Period Decay Removed (Final)

Date: 2026-02-14

## Scope
- Removed ellipsis period-decay mechanism completely from Welcome2.
- Preserved back-jump architecture and typing cadence behavior.

## Why Removed
- Product direction: cut ellipsis visuals are no longer desired in Welcome2.
- Goal: remove mechanism solidly and safely (no hidden state, no dead cleanup, no layout scaffolding).

## Code Changes
File: `src/screens/Welcome2.tsx`

### Removed constants
- `CUT_ELLIPSIS_TOTAL_DOTS`
- `CUT_ELLIPSIS_CHARS_PER_DOT_STEP`

### Removed ellipsis refs/state
- `cutLandingEndCoreRef`
- `cutLandingStartCharCountRef`
- `showCutEllipsis`

### Removed derived logic/effects
- `cutEllipsisDotCount` `useMemo`
- ellipsis cleanup effect that waited for `dotCount === 0`

### Removed Stage C ellipsis lifecycle writes
- Removed Stage C assignments that set ellipsis refs/state.
- Stage C now only seeks to cut target, clears stage flags, and resumes typing clock.

### Removed render + style artifacts
- Removed ellipsis overlay render block entirely.
- Removed `CURSOR_CLUSTER_STYLE` wrapper (ellipsis-only layout seam).
- Removed `CUT_ELLIPSIS_OVERLAY_STYLE`.
- Removed `CUT_ELLIPSIS_DOT_STYLE`.
- Restored direct cursor render after visible text with normal cursor margin.

### Cleanup helper simplification
- Renamed `clearPendingBackJump` to `cancelBackJumpSequence`.
- Helper now handles only sequence/timer cleanup and clock unpause.
- No ellipsis cleanup remains in the helper.

## Preserved Behavior Contracts
- Back-jump still uses Stage A/B/C sequence.
- Stage hold timing remains current runtime values:
  - `STABILIZE_STAGE_A_MS = 400`
  - `STABILIZE_STAGE_B_MS = 200`
- Back-step cut ratio remains:
  - `BACKSTEP_CUT_RATIO = 0.7`
- Part segmentation remains period-based.
- Timeline generation and typed cadence logic unchanged.
- `[->]` still cancels pending back-jump timers before finish action.

## Verification
- `npm run build` passed.

## Manual Validation Checklist
1. Trigger `[<-]` from part 2 and confirm Stage A -> B -> C still executes.
2. Confirm no dots, no extra characters, no overlay artifacts at any moment.
3. Spam `[<-]` during holds and confirm deterministic behavior with no dots.
4. Press `[->]` after back-jump and confirm clean finish with no dots.

## Notes
- Previous deep mechanism report is retained for history but marked deprecated:
  - `docs/report_2026_02_14_welcome2_ellipsis_period_decay_mechanism_detailed.md`
