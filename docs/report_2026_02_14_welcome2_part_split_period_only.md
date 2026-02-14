# Welcome2 Part Split Refinement - Period Only

Date: 2026-02-14

## Scope
- Updated part segmentation to use only `.` as part terminator.
- Comma and other punctuation now remain inside part content.

## Change
- File: `src/screens/welcome2SentenceSpans.ts`
- Updated `isPartTerminator(ch)`:
  - before: `, . ! ? ; :`
  - now: `.` only

## Preserved Behavior
- `endCoreCharCount` still includes the period (`i + 1`).
- `endSoftCharCount` still extends over trailing whitespace/newlines.
- No-period text still falls back to one trailing part `[0..len]`.

## Expected UX Effect
- `[<-]` back-jump now steps by period-delimited parts (full sentences), not comma/semicolon fragments.
- A/B/C stabilization sequence in Welcome2 remains unchanged and consumes new part spans safely.

## Verification
- `npm run build` passed.

## Quick Manual Checks
1. Comma-heavy sentence with one period remains one part until period.
2. Back-jump from second period-delimited sentence steps to previous sentence part.
3. No-period text does not crash and behaves as single part.
