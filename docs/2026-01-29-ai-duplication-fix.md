# Fix Report: AI Response Duplication

**Date**: 2026-01-29
**Status**: Fixed
**Root Cause**: Double-Yield in Stream Parser

## The Diagnosis
After the language update, user interactions with the AI resulted in responses appearing twice (concatenated).

### Investigation
1.  **Request Tracing**: Added `reqId` to `FullChatStore` and `openaiClient`. Confirmed that only **one network request** was being made. The double-request hypothesis was **false**, preserving tokens.
2.  **Stream Analysis**: The `openaiClient.ts` stream parser handles server-sent events.
    -   It correctly yields `response.output_text.delta` events.
    -   However, it *also* had a logic block listening for `response.output_item.done`.
    -   This final event contains the *full accumulated text* of the generation.
    -   The client was indiscriminately yielding this final text as a fallback.

### The Bug
```typescript
// OLD LOGIC (Simplified)
if (event.type === 'response.output_text.delta') {
    yield delta; // Text appears: "Hello"
} else if (event.type === 'response.output_item.done') {
    yield fullText; // Text appended again: "HelloHello"
}
```

Since the Store accumulates everything yielded (`accumulatedText += chunk`), receiving the full text at the end of the stream caused the entire message to duplicate.

## The Fix
I modified `src/ai/openaiClient.ts` to ignore the text content of `response.output_item.done` if we are in streaming mode. We rely solely on the deltas.

```typescript
// NEW LOGIC
if (event.type === 'response.output_item.done') {
    // Log length for debug, but DO NOT YIELD.
    // This prevents the duplication.
}
```

## Verification
-   **Single Request**: Confirmed via logs (only one request per user action).
-   **Single Append**: Confirmed code path no longer yields the final block.
-   **Token Safety**: Since we are not making two requests, we are paying for tokens only once. The duplication was pure client-side rendering.

## Status
The system now "just works" with single, clean streaming responses in any language.
