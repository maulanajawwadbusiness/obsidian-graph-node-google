# Welcome2 Cut Jump Cursor Gap Fix (Visible-Dot Width Only)

Date: 2026-02-14

## Scope
- Fix cursor spacing regression after Stage C 80 percent cut jump.
- Keep existing A/B/C back-jump flow and ellipsis decay cadence.

## Problem
- Cursor appeared too far from the typed text after cut jump.
- Expected contract: cursor should sit after the visible end with normal cursor gap.

## Root Cause
- In the slot-based smoothness fix, ellipsis rendered 3 dot slots at all times.
- Hidden slots used `opacity: 0`, which still occupies layout width.
- Result: even when only 1 or 2 dots were visible, cursor position was still pushed by full 3-dot width.

## Changes
- File: `src/screens/Welcome2.tsx`

1. Rendering update:
   - Before: rendered fixed `CUT_ELLIPSIS_TOTAL_DOTS` slots and hid extra slots with opacity.
   - After: render only `cutEllipsisDotCount` dot elements.

2. Style update:
   - Removed fixed container width from `CUT_ELLIPSIS_SLOTS_STYLE`.
   - Removed no-longer-needed opacity transition path in `CUT_ELLIPSIS_DOT_STYLE`.

## Preserved Behavior
- Ellipsis still decays deterministically using:
  - `CUT_ELLIPSIS_TOTAL_DOTS = 3`
  - `CUT_ELLIPSIS_CHARS_PER_DOT_STEP = 4`
- Back-jump Stage A/B/C timers and manual-seek behavior unchanged.
- Cleanup and cancel behavior unchanged.

## Why This Fix Works
- Cursor position now follows only visible dots.
- No invisible placeholder width remains between text and cursor.
- Cursor returns to expected near-end spacing through all decay states.

## Verification
- `npm run build` passed.

## Manual Validation Checklist
1. Trigger `[<-]` to run Stage C cut landing.
2. Confirm cursor sits at normal distance after visible cut text.
3. Confirm states look correct: `...|`, `..|`, `.|`, `|`.
4. Confirm `[->]` clears pending visuals correctly.
5. Confirm repeated `[<-]` interactions still behave deterministically.
