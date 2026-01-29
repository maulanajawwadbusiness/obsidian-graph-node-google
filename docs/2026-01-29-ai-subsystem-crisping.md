# AI Subsystem Crisping & Alignment

**Date**: 2026-01-29
**Goal**: Ensure all AI subsystems (FullChat, MiniChat, Prefill, LabelRewriter, Analyzer) use the `OpenAIClient` Responses API correctly, eliminating legacy parameter mismatches (`maxTokens`) and unstable configurations.

## Changes Verified

### 1. Parameter Alignment (Fixing "Unbounded" Tokens)
*   **Prefill Subsystem**: Updated `src/fullchat/prefillSuggestion.ts` to use system defaults (no `maxCompletionTokens`).
*   **Label Rewriter**: Updated `src/ai/labelRewriter.ts` to use system defaults (no `maxCompletionTokens`).

### 2. Reasoning Model Compatibility
*   **FullChat**: Removed `temperature` and `maxCompletionTokens` (relying on defaults) to prevent "incomplete" errors with `gpt-5-nano`.
*   **Paper Analyzer**: Removed `temperature` from `generateStructured` calls in `src/ai/paperAnalyzer.ts`. Reasoning models often reject or ignore temperature.

### 3. Regression Prevention
*   **Runtime Guards**: Added logic in `OpenAIClient.ts` to detect and warn if `maxTokens` is ever passed again.
    ```typescript
    if ((opts as any)?.maxTokens) console.warn('DEPRECATED: maxTokens...');
    ```

## Entry Points & Configuration
| Subsystem | File | Method | Model | Params |
| :--- | :--- | :--- | :--- | :--- |
| **FullChat** | `fullChatAi.ts` | `generateTextStream` | `gpt-5-nano` | Defaults (Reasoning) |
| **MiniChat** | `fullChatAi.ts` | `generateTextStream` | `gpt-5-nano` | Defaults (Reasoning) |
| **Prefill** | `prefillSuggestion.ts` | `generateText` | `gpt-5-nano` | Defaults (Reasoning) |
| **LabelRewrite**| `labelRewriter.ts` | `generateText` | `gpt-5-nano` | Defaults (Reasoning) |
| **Analyzer** | `paperAnalyzer.ts` | `generateStructured` | `gpt-5-nano` | Defaults (Reasoning) |

## Verification Status
*   [x] Audit complete: No `v1/chat/completions` usage.
*   [x] All paths use `OpenAIClient` (Responses API).
*   [x] Legacy params removed from call sites.
