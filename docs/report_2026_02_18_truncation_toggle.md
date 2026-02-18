# Truncation Toggle Run Report (2026-02-18)

## Summary
Implemented a code-level toggle for paper analyzer input truncation with a single source of truth and helper seam.
Default behavior is preserved: truncation remains enabled at 6000 chars.

## Files Changed
- `src/config/analyzeInputPolicy.ts`
  - Added canonical policy exports:
    - `ENABLE_ANALYZE_INPUT_TRUNCATION`
    - `ANALYZE_INPUT_MAX_CHARS`
    - `ANALYZE_INPUT_POLICY`
- `src/ai/analyzeInputPolicy.ts`
  - Added `applyAnalyzeInputPolicy(text, policy)` helper.
- `src/ai/paperAnalyzer.ts`
  - Replaced inline `text.slice(0, 6000)` with helper output.
  - Added one log line per request when truncation is actually applied.
- `docs/system.md`
  - Added AI architecture note for truncation policy ownership and flip instructions.

## Behavior After Change
- Default path (toggle ON):
  - Analyze input is truncated to 6000 chars before cost estimation and request payload.
  - If truncation is applied, one log line is emitted:
    - `[PaperAnalyzer] truncation_applied original_chars=<N> final_chars=<M> max_chars=<L>`
  - No user text content is logged.
- Toggle OFF path:
  - Full text is used.
  - No per-request truncation log spam.

## How To Flip The Toggle
- Edit `src/config/analyzeInputPolicy.ts`:
  - Set `ENABLE_ANALYZE_INPUT_TRUNCATION = false` to disable.
  - Set `ENABLE_ANALYZE_INPUT_TRUNCATION = true` to re-enable.
  - Optional: adjust `ANALYZE_INPUT_MAX_CHARS` if truncation stays enabled.

## Verification Steps
1. Build frontend app:
   - `npm run build`
2. Static seam check:
   - `paperAnalyzer.ts` no longer has hardcoded `slice(0, 6000)`.
3. Runtime behavior check (manual):
   - Analyze with text > 6000 chars and confirm one truncation log line appears.

## Notes
- `submitted_word_count` remains computed from original full input text, unchanged.
- If truncation is disabled, higher analyze cost estimates and backend 413 risk above server max text limit can surface; this is expected by policy choice.
