# Welcome2 Deterministic Timeline Builder (Step 2)

Date: 2026-02-07
Scope: Implement pure timeline builder for manifesto typing cadence. No audio. No React timing loop.

## Files Added or Updated

- Added: `src/screens/welcome2Timeline.ts`
- Added: `src/screens/welcome2ManifestoText.ts`
- Updated: `src/screens/Welcome2.tsx` (imports shared `MANIFESTO_TEXT`)

## Exported API

From `src/screens/welcome2Timeline.ts`:

- `type TimelineCharClass = 'letter' | 'digit' | 'space' | 'punct' | 'lineBreak'`
- `type PauseReason = 'base' | 'space' | 'comma' | 'period' | 'question' | 'lineBreak' | 'paragraph' | 'marker'`
- `type TimelineEvent`
  - `charIndex`
  - `tMs`
  - `char`
  - `class`
  - `pauseReason`
  - `pauseAfterMs`
- `type BuiltTimeline`
  - `rawText`
  - `renderText`
  - `events`
  - `totalMs`
- `function classifyChar(char)`
- `function buildWelcome2Timeline(rawText, cadence?)`
- `function debugWelcome2TimelineBuild()`

## Marker Grammar Supported

Supported marker grammar in this step:
- `{p=220}`
- Optional spaces inside marker are accepted, for example `{ p = 220 }`

Malformed marker behavior:
- Never throws.
- Falls back to `markerPauseDefaultMs`.
- Logs once per build call with:
  - `[Welcome2Type] malformed pause marker; using markerPauseDefaultMs`

## Priority and Cadence Rules Implemented

1. Marker wins:
- If a marker immediately follows a rendered char in raw text, that char uses marker pause.

2. Malformed marker fallback:
- Uses `markerPauseDefaultMs`.

3. Otherwise punctuation/newline rules:
- `,` uses `commaPauseMs`
- `.` uses `periodPauseMs`
- `?` uses `questionPauseMs`
- `\n` uses newline or paragraph policy

4. Paragraph handling for `\n\n`:
- Both newline chars are rendered as events.
- Paragraph pause is applied once after the second newline.

5. Anti-mush suppression:
- If the char before a paragraph break has explicit marker pause, paragraph pause is suppressed.

6. Time accumulation:
- First char appears at `tMs = 0`.
- For each event:
  - assign `tMs = currentTime`
  - add per-char cost
  - add pause-after cost
- `totalMs` includes `endHoldMs`.

7. Speed scaling:
- Timeline uses cadence pre-scaled via `applySpeed(cadence, 1.0)`, so `speedMultiplier` is applied once.

## Sample Output Excerpt (Current Manifesto + DEFAULT_CADENCE)

Observed via temporary compiled run:

- `renderText.length`: `399`
- `marker pause count`: `4`
- `totalMs`: `11886`

First events excerpt:

```text
0: char='F' tMs=0 class=letter pauseReason=base pauseAfterMs=0
1: char='o' tMs=26 class=letter pauseReason=base pauseAfterMs=0
2: char='r' tMs=52 class=letter pauseReason=base pauseAfterMs=0
3: char=' ' tMs=78 class=space pauseReason=space pauseAfterMs=0
4: char='m' tMs=78 class=letter pauseReason=base pauseAfterMs=0
5: char='e' tMs=104 class=letter pauseReason=base pauseAfterMs=0
6: char=',' tMs=130 class=punct pauseReason=comma pauseAfterMs=65
```

Last events excerpt:

```text
394: char='n' tMs=11196 class=letter pauseReason=base pauseAfterMs=0
395: char='t' tMs=11222 class=letter pauseReason=base pauseAfterMs=0
396: char='l' tMs=11248 class=letter pauseReason=base pauseAfterMs=0
397: char='y' tMs=11274 class=letter pauseReason=base pauseAfterMs=0
398: char='.' tMs=11300 class=punct pauseReason=period pauseAfterMs=140
```

## Verification Notes

- Determinism check: same input and cadence produced stable identical output.
- Paragraph suppression check:
  - `A{p=900}\n\nB` suppressed paragraph pause on second newline.
  - `A\n\nB` applied `paragraphPauseMs` on second newline.
- Build passed after integration (`npm run build`).
- No sound timeline, audio hooks, or SFX assets added.
