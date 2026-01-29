# Fix: Prefill Responses Shape Extraction

**Date**: 2026-01-29
**Issue**: Prefill AI was falling back to mock because `OpenAIClient.generateText` returned empty strings, logging "Unexpected response shape".
**Root Cause**: The Responses API returns a complex object (sometimes nested `output` arrays with `content` blocks), but `generateText` was only looking for a top-level `output_text` or simple structure.

## The Fix
1.  **Robust Extraction**: Updated `OpenAIClient.generateText` to use a recursive helper (similar to `generateStructured` and `generateTextStream`) that scans for:
    *   `obj.text`
    *   `obj.value`
    *   `obj.delta`
    *   Nested `content` arrays.
2.  **Relaxed Guard**: Removed the strict "Unexpected response shape" error. It now only warns if the *extracted content* is truly empty.
3.  **Verification**: Added logging in `prefillSuggestion.ts` (`[PrefillAI] raw_out len=...`) to confirm data flow.

## Result
`generateText` now correctly extracts text from the Responses API regardless of the specific nesting level, restoring real AI functionality to the Prefill feature.
