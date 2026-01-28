# Full Chatbar Fake Streaming

**Date**: 2026-01-28
**Status**: Implemented

## 1. Problem
The `OpenAIClient` is blocking (await full json), causing the AI response to appear "all at once" after a 2-5s delay. This breaks the expected conversational effect.

## 2. Solution: Client-Side Fake Streaming
We implemented a **chunker** inside the async generator `realResponseGenerator` in `src/fullchat/fullChatAi.ts`.

### Logic
1.  **Block**: Await the full text from OpenAI (`await client.generateText(...)`).
2.  **Stream**: Enter a loop that yields chunks of the text (4 chars every 12ms).
    *   This mimics a ~250 token/sec stream.
    *   It checks `AbortSignal` on every tick for instant cancellation.

### Integration
*   The `FullChatStore` already uses a `for await` loop to consume this generator.
*   The Store throttles updates to React state at ~32ms (30fps).
*   The interaction of "Fast Generator (12ms)" + "Throttled Store (32ms)" results in smooth, batched updates to the UI.

## 3. Verification
*   **Typing Effect**: Confirmed that text behaves as if typed, even though the network request was atomic.
*   **Cancellation**: Aborting the signal stops the `chunking loop` immediately.
*   **Mock Fallback**: Remains untouched (already fake-streams via its own generator).

## 4. Future Work
*   Upgrade `OpenAIClient` to use `response.body` and `eventsource-parser` for *true* streaming (Start -> First Token latency improvement).
