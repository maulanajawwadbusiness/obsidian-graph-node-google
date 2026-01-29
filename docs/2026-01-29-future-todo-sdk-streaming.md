# Future TODO: SDK-First Streaming Migration

**Date**: 2026-01-29
**Status**: Planned / Pending
**Goal**: Migrate Responses API streaming from manual SSE parsing to the official OpenAI SDK streaming abstraction.

## A. Goal & Philosophy
*   **Move away from "Manual SSE Parsing"**: Currently, `src/ai/openaiClient.ts` manually parses raw byte streams, splits by `\n\n`, and extracts JSON events. This is brittle.
*   **Adopt "SDK Correctness"**: We should treat the official OpenAI JS SDK as the source of truth for protocol handling.
*   **Standardization**: This aligns with the "Single SDK" unification plan (using one SDK for both OpenAI and OpenRouter).

## B. Current State (The "Before")
*   **Implementation**: `src/ai/openaiClient.ts` -> `generateTextStream`
*   **Method**: Uses `fetch`, `TextDecoder`, and a `while(true)` loop to parse `response.output_text.delta` events.
*   **Consumers**:
    *   `src/fullchat/fullChatAi.ts`: Consumes the generator and yields strings to the UI Store.
    *   `src/popup/PopupStore.tsx` (via MiniChat): indirect consumer of similar logic (if using shared client).

## C. Target Design (SDK-First)

### 1. Dependencies
*   Install `openai` (Official Node library).

### 2. Implementation Pattern
The `LLMClient` wrapper should simply delegate to the SDK's iterator:

```typescript
import OpenAI from 'openai';

// In generateTextStream...
const openai = new OpenAI({ apiKey: '...', baseURL: '...' }); // Configured once

const stream = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [ ... ],
    stream: true,
    // Note: Responses API parameters might need specific handling or
    // waiting for SDK support for 'max_completion_tokens' mapping.
});

for await (const chunk of stream) {
    // Abort handling via signal if SDK supports it, or check signal in loop
    if (signal?.aborted) break;

    // SDK normalizes deltas.
    // For reasoning models using v1/responses, ensure we map the right field.
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) yield content;
}
```

### 3. Invariants
*   **AbortSignal**: Must pass `signal` to the SDK if supported, or manually break the loop.
*   **Pump vs Source**: The Store (UI) must remain unaware of the switch. It expects `AsyncGenerator<string>`.
*   **No Smoothing**: The `LLMClient` must NOT artificially smooth the text. It yields exactly what the SDK yields.

## D. Migration Steps

1.  **Install SDK**: `npm install openai`
2.  **Prototype**: Create a `TestClient` that uses the SDK to hit `v1/responses` (or `chat/completions` if unified).
    *   *Risk*: Verify if current SDK supports `v1/responses` or if we still need raw fetch for that specific endpoint. If SDK lacks it, wait.
3.  **Replace `OpenAIClient` Internals**:
    *   Swap `fetch` loop for `openai.chat.completions.create({ stream: true })`.
4.  **Verify Event Mapping**:
    *   Ensure `chunk.choices[0].delta.content` maps correctly to `response.output_text.delta`.
5.  **Test Fallbacks**:
    *   Ensure disconnects/errors throw standard Error objects that `fullChatAi` can catch and fallback to mock.

## E. Fallback Strategy
*   **Default**: Assume SDK works.
*   **Exception**: If specific beta features (like `gpt-5` reasoning tokens) are missing from the SDK response, AND we can't get them, *only then* consider a hybrid approach.
*   **Offline**: The `fullChatAi` layer handles the "no API key" or "network error" fallback to Mock mode. The SDK wrapper should just throw.
