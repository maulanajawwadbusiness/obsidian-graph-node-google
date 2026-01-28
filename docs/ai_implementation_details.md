# AI Implementation Details: Helpers & Instantiation

This report provides a technical deep-dive into the retry/timeout helpers and the pattern for LLM client instantiation used in the repository.

## 1. Timeout & Abort Helper (`withTimeoutAndAbort`)

The repository uses a standardized helper to wrap asynchronous AI calls, ensuring they don't hang indefinitely and can be cancelled by UI interactions.

- **Location**: `src/fullchat/prefillSuggestion.ts` (Line 185)
- **Signature**:
  ```typescript
  async function withTimeoutAndAbort<T>(
      promise: Promise<T>, 
      timeoutMs: number, 
      signal?: AbortSignal
  ): Promise<T>
  ```

### Usage Pattern
The helper is typically used to wrap the `client.generateText` call:

```typescript
const rawOutput = await withTimeoutAndAbort(
    client.generateText(
        fullPrompt,
        { model: 'gpt-4o-mini', maxTokens: 60, temperature: 0.3 }
    ),
    2500, // REAL_TIMEOUT_MS
    options.signal
);
```

### Parameters & Return Behavior
- **`promise: Promise<T>`**: The actual AI work (usually `client.generateText`).
- **`timeoutMs: number`**: Hard limit for network execution.
- **`signal?: AbortSignal`**: The signal from an `AbortController` (e.g., from `FullChatBar` or a manual timeout).
- **Return**: Resolves to type `T` (the AI output string).
- **Error States**:
    - **Timeout**: Rejects with `new Error('Timeout')`.
    - **Abort**: Rejects with `new DOMException('Aborted', 'AbortError')`.

## 2. Client Instantiation Analysis

We performed a scan to determine if AI clients are shared/cached or recreated on demand.

### Verification Results
| Call Site | Location | Pattern |
| :--- | :--- | :--- |
| **Prefill Suggestion** | `src/fullchat/prefillSuggestion.ts` | **Per-Call** (Inside `refinePromptWithReal`) |
| **Label Rewriter** | `src/ai/labelRewriter.ts` | **Per-Call** (Inside `makeThreeWordLabels`) |

### Code Snippets
**Prefill implementation:**
```typescript
// src/fullchat/prefillSuggestion.ts:84
const client = createLLMClient({
    apiKey,
    mode: 'openai',
    defaultModel: 'gpt-4o-mini'
});
```

**Label rewriter implementation:**
```typescript
// src/ai/labelRewriter.ts:29
const client = createLLMClient({
    apiKey,
    mode: 'openai',
    defaultModel: 'gpt-4o-mini'
});
```

### Recommendation for New Features
Currently, the repo **does not use a cached singleton** for the AI client; it instantiates a new one via the factory on every call. While this adds negligible overhead for occasional UI interactions, we should follow this "instantiate-on-demand" pattern for now to remain consistent with the existing code, unless high-frequency calls are anticipated.
