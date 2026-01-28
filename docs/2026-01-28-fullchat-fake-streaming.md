# Full Chatbar Fake Streaming

**Date**: 2026-01-28
**Feature**: Fake Streaming (Chunking) for Real AI Responses

## Context
The current OpenAI client (`OpenAIClient.generateText`) is **blocking** (non-streaming). It waits for the full response before returning. To prevent a "wall of text" UX, we implemented a fake streaming mechanism that chunks the completed response and feeds it to the UI over time.

## Changes

### 1. `src/fullchat/fullChatAi.ts`
- **Modified**: `realResponseGenerator`
- **Logic**:
  - Awaits the full `responseText` from the client (blocking).
  - Enters a `while` loop to slice the text into **chunks of 4 characters**.
  - Yields each chunk.
  - Waits **15ms** between chunks.
  - Checks `signal.aborted` on every tick.

## Technical Details

- **Chunk Size**: 4 characters
- **Tick Rate**: ~15ms
- **Effective Speed**: ~260 chars/second (Feels fast but readable, "robotic-smooth").
- **Authority**: Since `FullChatStore` consumes this generator using `for await`, the `AbortSignal` passed to the generator ensures the loop terminates immediately if the user sends a new message or closes the chat.

## Verification Steps

### 1. Visual Test
1.  Open Full Chat.
2.  Send a message: "Write a short poem about the void."
3.  **Observation**:
    -   You will see "buffer" time (thinking) for 1-2 seconds.
    -   Then, text will start appearing **smoothly** (streaming), not all at once.
    -   The speed should initially feel like a fast typist.

### 2. Cancellation Test
1.  Send "Tell me a long story."
2.  Wait for streaming to start.
3.  Send "Stop." (or any new message).
4.  **Observation**: The first stream freezes/vanishes immediately, and the new message process begins.

## Risks / Future Work
- **Latency**: The initial "Thinking..." phase mimics the full generation time. For long responses (e.g., 500 tokens), this delay might contain the *entire* generation time (e.g., 5-10s) before *any* text appears.
- **Fix**: Implement True Streaming (SSE) in `OpenAIClient` to reduce Time-To-First-Token (TTFT).
