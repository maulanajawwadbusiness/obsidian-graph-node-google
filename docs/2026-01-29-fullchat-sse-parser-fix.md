# Fix: FullChat SSE Parsing (Zero Delta)

**Date**: 2026-01-29
**Issue**: FullChat streaming yielded zero text (`response_streamed len=0`) despite the stream starting and ending successfully.
**Root Cause**: The custom SSE parser in `OpenAIClient.ts` was splitting the stream by double-newlines but then iterating *lines* inside it and forcing a `startsWith('data: ')` check.
*   The Responses API sends frames like:
    ```
    event: response.created
    data: {...}
    ```
*   The parser saw the first line (`event: ...`), failed the `data:` check, and skipped the *entire frame*.

## The Fix
1.  **Correct Frame Parsing**: Rewrote the loop to split by `\n\n` (frames), then iterate lines *within* the frame to extract `event` and `data` separately.
2.  **Robust Extraction**:
    *   Added support for `response.output_text.delta` (standard streaming).
    *   Added fallback support for `response.output_item.done` (final item text), which ensures content is shown even if deltas are missed or not sent.
    *   Logged `response.incomplete` for better diagnostics.

## Verification
1.  **Open FullChat**: Send "Speak."
2.  **Check Logs**:
    *   Should see `[ResponsesStream] evt#... type=response.output_text.delta` (or `output_item.done`).
    *   Should see `[FullChatAI] got_delta` events.
    *   UI should show the text.
