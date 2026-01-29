# Fix: FullChat Incomplete/Zero-Delta Streaming

**Date**: 2026-01-29
**Issue**: FullChat stream yielded zero text despite valid connection, ending with `response.incomplete`.
**Root Cause**: The API was returning `response.output_item.done` (without preceeding deltas) and then `response.incomplete`. Our parsers were:
1.  Expecting `output_text.delta` (missing).
2.  Trying to extract from `output_item.done` but likely missing the specific schema structure (nested content vs flat) or the payload was just empty due to the incomplete status.

## The Fix
1.  **Deep Scan Logging**: Added verbose logging for `output_item.done` structure and `response.incomplete` reasons.
2.  **Robust Extraction**: Implemented a recursive `extractText` helper to pull text from any level of the `output_item.done` payload (handling `text`, `value`, `content` arrays).
3.  **Incomplete Diagnosis**: Logged specific `incomplete_details` to verify if token limits or filters are the cause.

## Verification
1.  **Open FullChat**: Send "Speak."
2.  **Check Logs**:
    *   Look for `[ResponsesStream] yielding fallback text`.
    *   If still failing, check `[ResponsesStream] response.incomplete` details in console for the reason (e.g. `max_tokens`, `content_filter`).
