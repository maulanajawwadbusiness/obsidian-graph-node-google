# Welcome2 Step 3 ScanDissect For Cadence Pivot

Date: 2026-02-11

## 1. Overview of Current Timing Stack

### Source files and roles
- `src/config/onboardingCadence.ts`
  - Defines cadence knobs and semantic knobs.
  - Normal semantic values:
    - `wordEndPauseMs = 27`
    - `heavyWordEndExtraPauseMs = 135`
    - `sentenceLandingExtraPauseMs = 180`
    - `landingTailChars = 3`
- `src/screens/welcome2Timeline.ts`
  - Builds deterministic timeline events (`tMs`, `pauseAfterMs`).
  - Computes both:
    - `semanticPauseByIndex` (boundary semantic pauses)
    - `extraDelayByIndex` (per-char extra delay, currently heavy-only envelope)
- `src/hooks/useTypedTimeline.ts`
  - rAF loop computes `elapsedMs = Math.round(nowMs - startTimeMs)`.
  - Uses binary search (`getVisibleCharCountAtElapsed`) to reveal chars by event timestamps.
  - Publishes state when visible count/phase changes or every `ELAPSED_PUBLISH_INTERVAL_MS = 100`.
- `src/screens/Welcome2.tsx`
  - Builds timeline once with `buildWelcome2Timeline(MANIFESTO_TEXT, DEFAULT_CADENCE)`.
  - Uses typed state to render visible text and cursor mode.
- `src/components/TypingCursor.tsx`
  - Visual only (animation modes by CSS keyframes), no timeline math.

### Current `charDelayMs` vs `pauseAfterMs` interaction
- `charDelayMs`:
  - base from `getCostBetweenChars` (`baseCharMs` or `spaceMs`)
  - letter/digit guard: `Math.max(MIN_LETTER_DIGIT_DELAY_MS, base)`
  - plus `extraDelayByIndex[i]` (current heavy envelope only)
- `pauseAfterMs`:
  - mechanical from `getPauseForChar` (comma/period/question/marker/space/base)
  - plus `semanticPauseByIndex[i]`
  - newline and paragraph pauses handled in dedicated newline branch.

## 2. Semantic Budget Placement (Current Behavior)

## Answer to key statement
- Statement checked:
  - "all semantic budgets are now applied via `extraDelayByIndex` and added into `charDelayMs`, while `pauseAfterMs` is mechanical only"
- This is **false** for current HEAD.
- Current truth:
  - `wordEndPauseMs` -> boundary (`semanticPauseByIndex`).
  - `sentenceLandingExtraPauseMs` -> punctuation boundary (`semanticPauseByIndex`).
  - `heavyWordEndExtraPauseMs` is split:
    - part to boundary (`semanticPauseByIndex`)
    - part to per-char envelope (`extraDelayByIndex`) on last up to 3 chars.

### Word-end + heavy mapping details
- Boundary map uses `buildNextBoundaryIndex`.
- For each word end:
  - boundary gets `wordEndPauseMs` (27ms).
- For heavy words:
  - `envelopeBudgetMs = clampMs(135 * 0.5) = 68ms`
  - `boundaryHeavyBudgetMs = 135 - 68 = 67ms`
  - boundary total from semantics for heavy word = `27 + 67 = 94ms`
  - envelope (68ms) distributed over last up to 3 letters by weights `[1,2,3]`, capped at 18ms/char.
  - practical result for 3-letter tail usually: `+11, +18, +18` (57ms used, leftover ignored).

### Sentence landing behavior
- `landingTailByPunctuationIndex` detects tails for `.` and `?`.
- `sentenceLandingExtraPauseMs` is attached to punctuation index only (boundary pause), no envelope.
- For period in sample:
  - punctuation semantic pause = `wordEndPauseMs (27) + landing (180) = 207`
  - in the first sentence, the period is followed by `{p=260}` marker on the same index.
  - marker wins over period pause in `getPauseForChar`, so pause is:
    - `marker 260 + semantic 207 = 467`
  - with base punct char delay ~42, observed delta is `509` (`42 + 467`).

### Concrete heavy-word example (EN manifesto: "intuitive")
- Region from current build:
  - word chars before tail mostly `42ms`
  - last 3 letters:
    - `i` -> `53ms` (`+11` extra)
    - `v` -> `60ms` (`+18` extra)
    - `e` -> `60ms` (`+18` extra)
  - following space boundary:
    - `108ms` (`space 14 + semantic 94`)
- So heavy phrase has both:
  - letter-level ramp from envelope
  - explicit boundary breath from semantic boundary pause.

## 3. Per-Letter Interval Stats (Jaggedness Evidence)

Forensic sample: first two EN manifesto sentences (up to second `.`), derived from current timeline math.

### Stats
- All chars:
  - min: `14ms`
  - median: `42ms`
  - p95: `60ms`
  - max: `1216ms` (boundary-heavy/paragraph-related outliers)
- Letters/digits only:
  - min: `42ms`
  - median: `42ms`
  - p95: `53ms`
  - max: `60ms`

### Pattern evidence
- Normal letter flow is flat at ~`42ms`.
- Heavy tail chars jump to `53-60ms` on final 2-3 letters.
- Boundary then jumps again (for heavy words) to ~`108ms` on following space.
- This creates a two-stage decel pattern:
  - local tail ramp
  - immediate boundary breath.
- This pattern can feel "jagged" if repeated often because ramps are discrete and capped.

### Sample slice format (`charIndex, char, class, deltaMs, extraDelayMs, semanticPauseMs`)
- `85, i, letter, 53, 11, 0`
- `86, v, letter, 60, 18, 0`
- `87, e, letter, 60, 18, 0`
- `88, <space>, space, 108, 0, 94`

## 4. Boundary Map + Candidate Knobs For Pivot

### Existing clean boundaries already available
- Spaces (`' '`)
- Punctuation (`',' '.' '?'` and boundary utility also recognizes `'!' ';' ':'`)
- Newlines (`'\\n'`) including dedicated double-newline paragraph branch
- Marker pauses (`{p=...}`) already attached as `pauseAfterMs` on previous printable char

### Feasibility of moving semantic budget fully to boundaries
- High feasibility with minimal risk:
  - remove or disable `extraDelayByIndex` semantic contributions.
  - route `wordEnd`, `heavy`, `landing` entirely into `semanticPauseByIndex` at computed boundary indices.
  - keep `charDelayMs` stable (`baseCharMs` + minimal or no semantic extras).
- This does not require changing:
  - event monotonicity logic
  - `totalMs` computation
  - binary search reveal logic in `useTypedTimeline`.

### Safe pivot knobs
- `HEAVY_ENVELOPE_FRACTION` -> set toward `0` to kill per-letter heavy ramp.
- Keep `wordEndPauseMs` on boundary only.
- Keep `sentenceLandingExtraPauseMs` on punctuation boundary only.
- Optional fine-tune for smoothness:
  - reduce `wordEndPauseMs` a little if boundaries feel too frequent.
  - keep punctuation/paragraph pauses as macro breath anchors.

### Gotchas
- If both `wordEndPauseMs` and landing pause stack on punctuation, punctuation jumps can become very large. This is macro-rhythm, not micro-jitter, but may feel abrupt.
- Newline branch has custom split/wait logic and paragraph semantics; do not mix per-letter semantics there if aiming for stable feel.

## 5. rAF + Rounding Impact

### Confirmed behavior in `useTypedTimeline`
- `elapsedMs` is rounded integer milliseconds:
  - `elapsedMs = Math.round(nowMs - startTimeMs)`
- frame dt is clamped for diagnostics:
  - `dt = clamp(nowMs - lastNowMs, 0, 1000)`
- reveal is by timestamp threshold against rounded `elapsedMs`.

### Impact on perceived staccato
- Browser frames are ~16.6ms at 60Hz.
- Small per-char differences (for example 42 vs 47 vs 53ms) can quantize into uneven frame crossings.
- That can amplify perceived "micro staccato" when many letters carry small semantic extras.
- Boundary-only semantics are less sensitive to this because rhythm changes are intentional, sparse, and phrase-level.

## Final Notes
- Current stack is hybrid, not all-envelope.
- The remaining letter-level jaggedness is coming from heavy envelope (`extraDelayByIndex`) plus boundary stacking.
- For the target feel ("solid letters, breaths at boundaries"), the cleanest pivot is to retire letter-level semantic extras and keep semantics boundary-bound.
