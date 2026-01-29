# Fix: FullChat Responses Streaming

**Date**: 2026-01-29
**Issue**: FullChat fell back to mock responses with `[FullChatAI] real stream failed`.
**Root Cause**:
1.  **Model Mismatch**: `src/fullchat/fullChatAi.ts` was hardcoded to `gpt-4o`.
2.  **Parameter Incompatibility**: Our recent `OpenAIClient` fix only removed the unsupported `temperature` parameter for `gpt-5-nano`. When `gpt-4o` was sent to the Responses API, it likely included `temperature`, causing a `400 Bad Request`, or `gpt-4o` itself isn't supported on the endpoint configuration.

## The Fix
1.  **Updated Model**: Changed `MODEL` constant in `src/fullchat/fullChatAi.ts` to `gpt-5-nano`.
2.  **Added Logging**: Added explicit exception logging in `FullChatAI` and event logging in `OpenAIClient` to catch any remaining issues.

## Verification
1.  **Open FullChat**: Send a message.
2.  **Check Logs**:
    *   Should see `[ResponsesStream] start model=gpt-5-nano`.
    *   Should see `[ResponsesStream] event type=response.output_text.delta`.
    *   Should NOT see `[FullChatAI] real stream failed`.
3.  **Behavior**: The chat should stream token-by-token instead of showing the mock "void of data" message.
