# Welcome2 Ellipsis Period Decay Mechanism (Detailed Technical Report)

DEPRECATED NOTICE (2026-02-14):
- This mechanism has been removed completely from `src/screens/Welcome2.tsx`.
- Welcome2 no longer renders cut ellipsis dots and no longer keeps ellipsis lifecycle state.
- Current behavior reference is documented in:
  - `docs/report_2026_02_14_welcome2_ellipsis_removed.md`

Date: 2026-02-14
File of truth: `src/screens/Welcome2.tsx`

## 1. Purpose and Context
This report documents how the cut ellipsis period-decay mechanism works in Welcome2 after the current back-jump architecture and recent cursor-stability hardening.

The mechanism is tied to the `[<-]` back-jump sequence. After the sequence lands at a backward cut point (80 percent inside the previous part), an ellipsis (`...`) is shown as a visual indicator of truncation/cut. Then that ellipsis decays over time while typing resumes.

Important: the ellipsis mechanism is visual-only. It does not modify timeline events or cadence generation.

## 2. Terminology
- Part: a period-delimited text segment from `buildWelcome2SentenceSpans`.
- Stage A: seek to current part start pre-char (stabilize hold).
- Stage B: seek to previous part end-core (stabilize hold).
- Stage C: seek backward to previous part cut position (80 percent), then resume typing.
- End-core: part end including the period (`.`), excluding trailing whitespace.
- Cut ellipsis: temporary dots shown after Stage C landing.

## 3. Runtime Flow
### 3.1 Trigger
User clicks left seek button (`handleSeekRestartSentence`) in `Welcome2`.

### 3.2 Stage chain
`goPreviousPartWithStabilize()` executes:
1. Cancel pending timers and prior cut state.
2. Pause typed clock (`setClockPaused(true)`).
3. Stage A seek to current start pre-char and hold (`STABILIZE_STAGE_A_MS`).
4. Stage B seek to previous end-core and hold (`STABILIZE_STAGE_B_MS`).
5. Stage C seek to cut point, then unpause (`setClockPaused(false)`).

### 3.3 Cut point math
For previous part:
- `previousPartLen = max(0, previousPartEndCore - previousPartStart)`
- `cutWithinPart = max(1, min(floor(previousPartLen * 0.8), previousPartLen))`
- `cutCharCount = previousPartStart + cutWithinPart` (or `previousPartEndCore` for empty)

This guarantees the Stage C landing is inside the prior part for non-empty parts.

## 4. Core State for Ellipsis Decay
The mechanism uses these refs/state:
- `cutLandingEndCoreRef: number | null`
  - stores previous part end-core char count at Stage C landing.
- `cutLandingStartCharCountRef: number | null`
  - stores Stage C landing char count (`cutCharCount`).
- `showCutEllipsis: boolean`
  - gate that enables decay rendering lifecycle.

Set path:
- At Stage C completion:
  - `cutLandingEndCoreRef.current = previousPartEndCore`
  - `cutLandingStartCharCountRef.current = cutCharCount`
  - `setShowCutEllipsis(cutCharCount < previousPartEndCore)`

Clear path:
- `clearPendingBackJump()` clears both refs + flag.
- Auto cleanup effect clears when decay reaches 0 dots.
- `[->]` path calls `clearPendingBackJump()` before finish seek.
- Unmount cleanup also clears pending back-jump state.

## 5. Decay Computation
Constants:
- `CUT_ELLIPSIS_TOTAL_DOTS = 3`
- `CUT_ELLIPSIS_CHARS_PER_DOT_STEP = 4`

Derived value:
- `cutEllipsisDotCount` (`useMemo`) computed from current `visibleCharCount`.

Formula:
1. Guard returns 0 when not active or refs missing.
2. If `visibleCharCount >= cutLandingEndCore`, return 0.
3. `charsSinceLanding = max(0, visibleCharCount - cutLandingStartCharCount)`
4. `dotStepsConsumed = floor(charsSinceLanding / CUT_ELLIPSIS_CHARS_PER_DOT_STEP)`
5. `dotCount = max(0, CUT_ELLIPSIS_TOTAL_DOTS - dotStepsConsumed)`

Current decay ladder:
- 0 to 3 new chars: `...`
- 4 to 7 new chars: `..`
- 8 to 11 new chars: `.`
- 12+ new chars: hidden

## 6. Render Architecture (Current)
The current implementation uses a cursor cluster wrapper and an out-of-flow overlay for the ellipsis.

### 6.1 Why overlay exists
If dots are in normal inline flow, reducing `...` to `..` to `.` shrinks line width and shifts cursor x-position left. Then typed characters push it right again. This creates visible back-forth jitter.

### 6.2 Current solution
In the manifesto line:
- `visibleText` renders in normal flow.
- Cursor and cut ellipsis are wrapped by `CURSOR_CLUSTER_STYLE`.
- Ellipsis uses `CUT_ELLIPSIS_OVERLAY_STYLE`:
  - `position: absolute`
  - `right: 100%`
  - `top: 0`
  - `whiteSpace: nowrap`

Effect:
- Ellipsis is visually attached near the cursor but out of flow.
- Dot decay does not alter inline layout width.
- Cursor horizontal position is driven by typed text progression, not ellipsis width changes.

## 7. Interaction with Typed Timeline
Ellipsis decay progression depends on `visibleCharCount`, which comes from `useTypedTimeline`.

Key points:
- `useTypedTimeline` advances by elapsed timeline time (binary-search event visibility).
- Stage A/B holds pause clock (`setClockPaused(true)`), so no typing progress during holds.
- At Stage C completion, clock resumes; `visibleCharCount` starts advancing.
- Each advancement eventually reduces dot count by the formula above.

No timeline event is created for ellipsis itself.

## 8. Boundary and Safety Behavior
### 8.1 No stale dots
Cleanup effect:
- if `showCutEllipsis` is true and `cutEllipsisDotCount` becomes 0,
- clears refs and sets `showCutEllipsis` false.

### 8.2 Cancel/restart deterministic behavior
On new back-jump click:
- pending A/B/C timers are canceled,
- cut refs and ellipsis flag are reset,
- sequence restarts from clean state.

### 8.3 Forward finish behavior
`[->]` first clears pending back-jump/cut state, then finishes current part.
This prevents stale cut ellipsis from leaking into forward seek output.

### 8.4 Empty or degenerate part guard
When previous part length is not positive, cut char resolves to end-core and `showCutEllipsis` may be false (`cutCharCount < endCore` guard), preventing invalid ellipsis display.

## 9. Visual Contracts (Current)
1. Ellipsis appears only after Stage C cut landing and only when cut is strictly before end-core.
2. Ellipsis decays deterministically by typed-char progress, not by wall-clock timers.
3. Ellipsis is visual-only; it does not change content timeline or cadence.
4. Cursor should not jump backward due to decay because ellipsis is overlaid out-of-flow.

## 10. Tunable Knobs
In `Welcome2.tsx`:
- `CUT_ELLIPSIS_TOTAL_DOTS`
  - number of initial dots (currently 3).
- `CUT_ELLIPSIS_CHARS_PER_DOT_STEP`
  - decay pace (currently 4 chars per dot).
- `STABILIZE_STAGE_A_MS`, `STABILIZE_STAGE_B_MS`
  - affect when Stage C starts (indirectly affects when ellipsis begins).

## 11. Known Risks and Perception Notes
1. If `visibleCharCount` jumps multiple chars in one frame (tab resume/frame stall), dot count can drop by more than one step at once.
2. Near wrap boundaries, typed-text growth itself can still move cursor to next line; this is expected layout behavior and separate from ellipsis decay.
3. Any future change that reintroduces in-flow ellipsis width mutation can bring back cursor x jitter.

## 12. Minimal Validation Checklist
1. Trigger `[<-]` from part 2+ and confirm A/B/C sequence still executes.
2. At Stage C landing, confirm ellipsis appears only when cut < end-core.
3. Confirm decay pattern under continuous typing: `...`, `..`, `.`, hidden.
4. Confirm cursor does not shift backward when dots decay.
5. Confirm `[->]` during/after cut clears ellipsis cleanly.
6. Confirm spam-click `[<-]` remains deterministic with no stale dots.

## 13. Relevant Source Anchors
- `src/screens/Welcome2.tsx`
  - Stage sequence and cut calculation
  - cut refs + state lifecycle
  - dot-count derivation
  - overlay render and styles
- `src/hooks/useTypedTimeline.ts`
  - source of `visibleCharCount`
  - clock pause/resume semantics used by stabilize holds
