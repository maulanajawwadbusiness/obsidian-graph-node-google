# Full Chatbar True Streaming (V2)

**Date**: 2026-01-29
**Feature**: True SSE Streaming via OpenAI API
**Status**: Live

## Context
Previously, we used "Fake Streaming" (wait for full response, then slice it). This introduced a "thinking" pause equal to the generation time.
Text generation has been upgraded to **True Streaming**, using Server-Sent Events (SSE) to deliver chunks as soon as the model yields them.

## Implementation Details

### 1. `src/ai/openaiClient.ts`
- **New Method**: `generateTextStream(prompt, opts, signal)`
- **Mechanism**:
  - Sets `stream: true` in the OpenAI request.
  - Consumes `response.body` via a `TextDecoder` stream.
  - Buffers text and splits by `\n\n` to isolate SSE frames.
  - Parses `data: ...` JSON payloads.
  - Yields `choices[0].delta.content`.
- **Parsing Robustness**:
  - Handles `[DONE]` signal.
  - Ignores malformed chunks/keep-alives to prevent crashing.
  - Handles the `include_usage` edge case (empty `choices`) by safely checking optional chaining.

### 2. `src/fullchat/fullChatAi.ts`
- **Changed**: `realResponseGenerator` now consumes the async generator from the client.
- **Removed**: The `while` loop that sliced the string.
- **Result**: Data flows from Network -> Generator -> Store -> UI with zero artificial delay.

### 3. `src/fullchat/FullChatStore.tsx` (Unchanged)
- **The Pump**: The store logic remains identical.
- **Throttling**: The existing 32ms (~30fps) throttle ensures that high-velocity streams don't overwhelm React rendering.

## Edge Cases

### Cancellation
- `AbortSignal` is passed all the way to the `fetch` call.
- If aborted, the loop breaks immediately, and the network request is cancelled.

### Connectivity
- If the stream hangs or fails, the store catches the error and stops the stream cleanly.

## Verification Checklist

1.  **Speed**: Response should start appearing typically within <1s (Time To First Token).
2.  **Smoothness**: Flow should be consistent, though speed will vary based on model load (this is authentic).
3.  **Cancellation**: Typing a new message mid-stream should instantly cut off the old stream.
