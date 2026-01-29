# Forensic Report: Responses API Streaming Mechanics

**Date**: 2026-01-29
**Subject**: detailed analysis of `OpenAIClient.generateTextStream` using the `v1/responses` endpoint.

## 1. Overview
The application uses a custom implementation of Server-Sent Events (SSE) parsing to consume the streaming output from the OpenAI `v1/responses` API. This is critical because the standard parsing libraries often fail to handle the specific event types returned by this endpoint, especially with reasoning models (`gpt-5` series).

## 2. The Wire Protocol

### Endpoint
*   **URL**: `https://api.openai.com/v1/responses`
*   **Method**: `POST`
*   **Headers**:
    *   `Content-Type`: `application/json`
    *   `Authorization`: `Bearer <KEY>`

### Payload Structure
```json
{
  "model": "gpt-5-nano",
  "input": [{ "role": "user", "content": "..." }],
  "stream": true,
  "store": false,
  "max_output_tokens": 1234 // Note: NOT max_tokens
}
```
*   **Note**: `temperature` is explicitly omitted for `gpt-5` reasoning models to avoid conflicts.

## 3. Streaming Logic (The Receiver)

The client (`src/ai/openaiClient.ts`) uses a `TextDecoder` loop to read chunks from the `response.body`.

### A. Frame Splitting
The raw byte stream is decoded to a string and split by `\n\n`. This identifies individual SSE frames.
*   **Robustness**: The buffer logic (`buffer = frames.pop() || ''`) ensures that a chunk ending in the middle of a frame is held over until the next chunk arrives.

### B. Event Parsing
Each frame is parsed for lines starting with `data: `.
*   **Stop Signal**: If data is `[DONE]`, the stream closes.
*   **JSON Parse**: The data payload is parsed as JSON.

### C. Event Types
The loop listens for three specific event types unique to the `responses` API:

1.  **`response.output_text.delta`** (Primary)
    *   **Payload**: `{ type: '...', delta: "some text" }`
    *   **Action**: Directly yields `event.delta` to the consumer. This is the main source of "typing" effect.

2.  **`response.output_item.done`** (Completion / Fallback)
    *   **Payload**: Contains the full final state of the item.
    *   **Action**:
        *   Logs structural details for debugging.
        *   **Redundancy Check**: It attempts to extract text from this final event using the robust `extractText` helper.
        *   **Yield**: If text is found (that might have been missed by deltas), it yields it. *Note: In practice, this usually yields nothing if deltas were perfect, but acts as a safety net.*

3.  **`response.incomplete`** (Warning)
    *   **Action**: Logs a warning with details (e.g., `max_output_tokens` reached).

## 4. Robust Text Extraction
To handle the variable shape of `item.content` or `item.text`, the stream implementation uses a recursive helper (similar to the non-streaming one):
```typescript
const extractText = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj.text === 'string') return obj.text;           // Direct text
    if (typeof obj.value === 'string') return obj.value;         // Value field
    if (Array.isArray(obj.content)) return obj.content.map(extractText).join(''); // Recursive array
    if (obj.type === 'text' || obj.type === 'output_text') return obj.text || '';
    return '';
};
```

## 5. Critical Observations
1.  **Manual Implementation**: We are NOT using the official SDK's `stream: true` helper. We are manually parsing SSE. This gives us control but requires maintenance if the protocol changes.
2.  **Delta vs. Content**: The code prioritizes `delta` events for smoothness.
3.  **Error Handling**: The stream swallows some parse errors (`console.log('[ResponsesStream] parse_error')`) to prevent the entire stream from crashing due to a single malformed chunk.

## 6. Recommendations
*   **Keep existing logic**: It is currently working and robust against shape changes.
*   **Monitor `event.type`**: If OpenAI introduces new event types (e.g. `response.tool_call`), this loop will ignore them.
*   **Future**: When migrating to the Single SDK, we will replace this manual parsing with the SDK's iterator, but we must verify it handles `response.output_text.delta` correctly.
