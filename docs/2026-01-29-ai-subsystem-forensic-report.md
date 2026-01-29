# Forensic Report: AI Subsystem Alignment

**Date**: 2026-01-29
**Scope**: MiniChat, FullChat, Document Parser, Label Rewriter
**Target**: Alignment with `OpenAIClient` and Responses API (Google/OpenAI hybrid).

## Executive Summary
The forensic analysis reveals a mixed state. `FullChat` and `MiniChat` are now **aligned** and operational following recent fixes. However, secondary systems (`Prefill`, `LabelRewriter`, `DocumentParser`) contain parameter execution errors that force them into fallback or default states, specifically regarding token limits (`maxTokens` regression) and reasoning model configuration.

## 1. FullChat & MiniChat (`src/fullchat/fullChatAi.ts`)
*   **Status**: **ALIGNED (Fix Verification)**
*   **Logic**: Both systems share `realResponseGenerator` in `fullChatAi.ts`.
*   **Model**: `gpt-5-nano`
*   **Streaming**: Yes (`generateTextStream`).
*   **Params**: `temperature` and `maxCompletionTokens` were removed. The system now correctly relies on server-side defaults for reasoning models.
*   **Verdict**: Operational and aligned.

## 2. Prefill Subsystem (`src/fullchat/prefillSuggestion.ts`)
*   **Status**: **MISALIGNED (Parameter Mismatch)**
*   **Model**: `gpt-4o`
*   **Method**: `generateText`
*   **Critical Fault**: Passes `maxTokens: 60`.
    *   `OpenAIClient` expects `maxCompletionTokens` (mapped to `max_output_tokens`).
    *   **Result**: The API receives NO token limit. It defaults to the model's maximum (e.g., 4096+), which is safe but violates the "quick/short" intent of the prefill feature.
*   **Secondary Fault**: Uses `temperature: 0.3`. Safe for `gpt-4o`, but will break if upgraded to `gpt-5`.

## 3. Document Parsing (`src/ai/paperAnalyzer.ts`)
*   **Status**: **RISK (Reasoning Configuration)**
*   **Model**: `gpt-5`
*   **Method**: `generateStructured`
*   **Critical Fault**: Passes `temperature: 0.3`.
    *   If `gpt-5` is a reasoning model (high likelihood given naming convention), `temperature` is often unsupported.
    *   **Result**: Potential `response.incomplete` or API warning.
*   **Schema**: Uses robust JSON Schema. Aligns well with `generateStructured`.
*   **Timeout**: 15s hard timeout is risky for deep reasoning on 6k characters.

## 4. Label Rewriter (`src/ai/labelRewriter.ts`)
*   **Status**: **MISALIGNED (Parameter Mismatch)**
*   **Model**: `gpt-4o`
*   **Method**: `generateText`
*   **Critical Fault**: Passes `maxTokens: 100`.
    *   Same as Prefill: effectively runs unbounded.
    *   **Result**: Wasted tokens if model hallucinates a long response.

## Action Plan
1.  **Immediate**: Update `prefillSuggestion.ts` and `labelRewriter.ts` to use `maxCompletionTokens`.
2.  **Config**: Remove `temperature` from `paperAnalyzer.ts` to ensure `gpt-5` compatibility.
3.  **Architecture**: Refactor `LLMClient` types to strictly omit `maxTokens` to prevent future regressions.
