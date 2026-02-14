# Welcome2 Cursor Stability Fix During Cut Retyping (Overlay Ellipsis)

Date: 2026-02-14

## Scope
- Eliminate cursor back-forth horizontal jumps during cut ellipsis decay.
- Preserve cut-decay semantics and Stage A/B/C jump behavior.

## Problem
- During cut retyping, ellipsis changed from `...` to `..` to `.` to hidden.
- Each dot removal changed inline width in the text flow.
- Cursor moved left on decay steps and right on subsequent typed chars, perceived as abrupt jump.

## Root Cause
- Ellipsis was rendered inline before the cursor.
- Dot count reduction removed layout width from the active line.
- Cursor x-position depends on inline content width, so decay directly moved cursor x.

## Changes
- File: `src/screens/Welcome2.tsx`

1. Added cursor cluster wrapper:
   - `CURSOR_CLUSTER_STYLE`
   - `display: inline-block`, `position: relative`, `marginLeft: 4px`

2. Moved cut ellipsis to out-of-flow overlay:
   - `CUT_ELLIPSIS_OVERLAY_STYLE`
   - `position: absolute`, `right: 100%`, `top: 0`, `whiteSpace: nowrap`

3. Kept deterministic decay logic unchanged:
   - `CUT_ELLIPSIS_TOTAL_DOTS = 3`
   - `CUT_ELLIPSIS_CHARS_PER_DOT_STEP = 4`
   - Render count still follows `cutEllipsisDotCount`

4. Cursor spacing refactor:
   - `CURSOR_STYLE.marginLeft` moved from `4px` to `0`
   - gap now owned by cluster wrapper (`marginLeft: 4px`)

## Preserved Contracts
- Stage A/B/C sequence unchanged.
- Manual seek suppression of auto-advance unchanged.
- Pending timer cancellation and cut cleanup unchanged.

## Why This Fix Works
- Ellipsis is now visual-only relative to cursor and does not consume inline width.
- Dot decay no longer changes the line layout width.
- Cursor horizontal position is driven by typed text only, preventing back-forth jumps from ellipsis decay.

## Verification
- `npm run build` passed.

## Manual Validation Checklist
1. Trigger Stage C cut jump from mid-sentence.
2. Confirm decay still appears as `...`, `..`, `.`, hidden.
3. Confirm cursor does not shift backward when dots decay.
4. Confirm normal forward cursor movement as chars type in.
5. Confirm `[->]` and repeated `[<-]` still behave deterministically.
