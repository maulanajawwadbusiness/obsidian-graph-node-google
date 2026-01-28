# AI Client Streaming Investigation

**Date**: 2026-01-28
**Status**: Confirmed (No Streaming Support)

## 1. Component Identification
- **Client Implementation**: `src/ai/openaiClient.ts`
- **Class**: `OpenAIClient`
- **Interface**: `LLMClient` (in `src/ai/clientTypes.ts`)

## 2. Findings: Why it is NOT streaming
We scanned the `generateText` method and found it is implemented as a blocking Request/Response pattern.

### Evidence A: Missing Stream Flag
The request body sent to OpenAI does **not** include the `stream: true` parameter.
```typescript
body: JSON.stringify({
    model,
    messages: [...],
    temperature,
    max_completion_tokens: maxTokens
    // MISSING: stream: true
})
```

### Evidence B: Blocking Response Parsing
The code awaits the full JSON body before returning. It does not read from the `response.body` stream.
```typescript
// This waits for the entire network packet to finish
const data = await response.json(); 
const content = data.choices?.[0]?.message?.content;
```

### Evidence C: Interface Limitation
The interface `LLMClient` defines the return type as a simple Promise, not an iterator or stream.
```typescript
generateText(...): Promise<string>;
```

## 3. The Problem
The current UI "streaming" effect (implementing in Phase 1) is currently **simulated** on the receiving end. The Store waits ~2-5 seconds for the full text to arrive from OpenAI, and *then* simulates typing it out.
**Impact**: High latency. The user sees "Thinking..." for the full duration of generation, then the text appears. True streaming would show the first token immediately (milliseconds).

## 4. Recommended Fix (Refactoring Plan)
To enable true streaming, we need to upgrade the client:

1.  **Update Interface**: Add `generateStream(...)` to `LLMClient` that returns `AsyncGenerator<string, void, unknown>`.
2.  **Update Implementation**:
    -   Set `stream: true` in fetch options.
    -   Use `createParser` (from `eventsource-parser` or manual implementation) to read `response.body`.
    -   Yield content deltas (`delta.content`) as they arrive.
3.  **Update Call Site**: Switch `fullChatAi.ts` to use `client.generateStream` and yield chunks directly to the UI store.
