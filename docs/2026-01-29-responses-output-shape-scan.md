# Fix: Deep Scan & Text Extraction (Responses API)

**Date**: 2026-01-29
**Issue**: `no content in structured response` persists despite `output` array existence.
**Root Cause**: The exact shape of the returned text blocks is likely not matching our previous assumptions (e.g., standard `type: 'text'` vs `type: 'output_text'` or nested `text.value`).

## The Fix
Updated `src/ai/openaiClient.ts` with:

1.  **Deep Scan Logging**:
    *   Iterates `data.output[]` and logs `type`, `role`, and `content` length.
    *   Iterates `item.content[]` and logs the `keys` and a `preview` of any text-like values.
    *   This provides a definitive map of the payload for diagnosis.

2.  **Robust Extraction Logic**:
    *   Replaced rigid checks with a helper `extractText(obj)`.
    *   Scans for `text`, `value`, and `delta` properties on *any* object found in the content stream.
    *   Handles flat blocks (`item` itself) and nested blocks (`item.content[]`).
    *   Joins all found fragments into a single `jsonString`.
    *   Attempts `JSON.parse` on the result.

## Verification
1.  **Upload Text File**: Test the Paper Analyzer flow again.
2.  **Console Logs**: If it succeeds, the logs will show the structure we successfully parsed. If it fails, the "Deep Scan" logs will reveal exactly which fields we missed, allowing for a 30-second fix.
