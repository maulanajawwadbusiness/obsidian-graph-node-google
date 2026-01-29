# Responses API Migration Recon Report

**Date**: 2026-01-29
**Goal**: Migrate from Chat Completions (`v1/chat/completions`) to Responses API (`v1/responses`).
**Model**: Defaulting to `gpt-5-nano`.

## 1. Existing Architecture Analysis

### AI Client (`src/ai/openaiClient.ts`)
*   **Current State**:
    *   `generateText`: Blocking call, fetches `v1/chat/completions`.
    *   `generateTextStream`: Streaming call, uses SSE parsing with `choices[0].delta.content`.
    *   `generateStructured`: Stubbed (throws Error).
*   **Migration Needs**:
    *   Update endpoint to `v1/responses`.
    *   Payload: Change `messages` style if needed (Responses API accepts standard message arrays). Use `store: false`.
    *   Streaming: Change SSE listener to `response.output_text.delta`.
    *   Structured: Implement `response_format: { type: "json_schema", ... }` logic.

### Client Factory (`src/ai/index.ts`)
*   **Current State**: Simple factory.
*   **Migration Needs**: Minimal. Just needs to handle the configured model default.

### Config
*   **Current State**: Hardcoded `gpt-4o` defaults in constructor.
*   **Migration Needs**: Add `VITE_OPENAI_MODEL_DEFAULT` variable (defaulting to `gpt-5-nano`).

## 2. Structured Output Target: Paper Analyzer

### File: `src/ai/paperAnalyzer.ts` (Pending read, strictly anticipating needs)
*   **Requirement**: Needs to extract specific fields (Title, 5 Key Points).
*   **Target Schema**:
    ```json
    {
      "type": "object",
      "properties": {
        "paper_title": { "type": "string" },
        "main_points": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "explanation": { "type": "string" }
            },
            "required": ["title", "explanation"],
            "additionalProperties": false
          },
          "minItems": 5,
          "maxItems": 5
        }
      },
      "required": ["paper_title", "main_points"],
      "additionalProperties": false
    }
    ```

## 3. Streaming Changes

### New SSE Protocol
*   **Event**: `response.output_text.delta` (instead of generic data chunks).
*   **Data**: `event.delta` contains the text fragment.
*   **Hygiene**: The existing `FullChatStore` throttling remains the safety layer. No functional changes needed there.

## 4. Edge Cases & Risks
*   **Model Availability**: Ensure `gpt-5-nano` is available to the key. Fallback logic remains critical.
*   **Abort Behavior**: `v1/responses` might behave differently on network aborts, but client-side `AbortController` logic should be identical (stop reading stream).
*   **Error Handling**: Responses API might return different error shapes. Need robust catch blocks.

## 5. Migration Strategy (Minimal Diff)
1.  **Dual-Purpose Client**: For now, we will *replace* the implementation inside `OpenAIClient` rather than creating a parallel one, as `gpt-5-nano` is the target for everything.
2.  **Interface stability**: `generateText` and `generateTextStream` signatures stay 100% identical.

