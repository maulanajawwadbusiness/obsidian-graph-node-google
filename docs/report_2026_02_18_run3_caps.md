# Run 3 Caps Report
Date: 2026-02-18
Scope: server beta caps core module only, no route wiring.

## Changes
- Added module:
  - `src/server/src/llm/betaCaps.ts`
- Added functions:
  - `computeWordCount(text)`
  - `getTodayKeyUTC()`
  - `getDailyUsedWords(db, userId, dateKey)`
  - `checkCaps({ db, userId, submittedWordCount, requestId, capsEnabled })`
  - `recordUsage({ db, userId, dateKey, deltaWords, requestId, capsEnabled })`

## Constants used
- `src/server/src/llm/betaCapsConfig.ts`
  - `betaPerDocWordLimit = 7500`
  - `betaDailyWordLimit = 150000`

## Guard behavior
- All operational functions are no-op safe when `capsEnabled` is false:
  - `checkCaps` returns `ok: true` without DB read.
  - `recordUsage` exits early and does not write.

## Log lines
- Check log:
  - `[caps] check request_id=... user_id=... code=... submitted_words=... daily_used=... date_key=...`
- Record log:
  - `[caps] record request_id=... user_id=... date_key=... delta_words=... used_words=...`

## Verification
- `src/server`: `npm run build` passed.
