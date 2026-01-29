# Forensic Report: Legacy LLMClient (OpenRouter)

**Date**: 2026-01-29
**Subject**: `src/ai/openrouterClient.ts`
**Role**: Legacy implementation for non-OpenAI models (via OpenRouter).

## Overview
The `OpenRouterClient` implements the `LLMClient` interface but uses the standard **Chat Completions API** (`v1/chat/completions`) rather than the new `v1/responses` API used by `OpenAIClient`. It was designed to route requests to various models hosted on OpenRouter, specifically favoring experimental models like Google's Gemini.

## Critical Findings

### 1. API Protocol Mismatch
*   **OpenAIClient (Modern)**: Uses `POST /v1/responses`. Expects google-style parameter mappings (`max_output_tokens`).
*   **OpenRouterClient (Legacy)**: Uses `POST /api/v1/chat/completions`. Expects standard OpenAI-style parameters (`max_tokens`).

### 2. Parameter Conflict: `maxCompletionTokens` vs `max_tokens`
The `LLMClient` interface was recently updated to enforce `maxCompletionTokens`.
*   **Impact**: `OpenRouterClient.generateText` likely breaks or sends undefined token limits because it expects to map to `max_tokens`.
*   *Code Scan Needed*: Verify if `OpenRouterClient` was updated to map `maxCompletionTokens` -> `max_tokens`. If not, it's effectively running with default (possibly infinite) limits.

### 3. Model Assumptions
*   **Default Model**: `google/gemini-2.0-flash-exp`.
*   **Conflict**: The rest of the app (`aiModels.ts`) is now standardized on `gpt-5-nano`. Sending `gpt-5-nano` to OpenRouter might fail or require specific routing/credits if OpenRouter doesn't host it or if the mapping is wrong.

### 4. Output Extraction
*   **Method**: `choice[0].message.content`.
*   **Conflict**: If the app expects the robust recursive extraction we just built for `OpenAIClient`, this client will fail on nested/complex outputs, though typical Chat Completions structure is simpler.

## Conclusion
The `OpenRouterClient` is currently a secondary, potentially broken path. It aligns with the *interface* type signature but likely fails on parameter mapping (`max_tokens`) and relies on an older API protocol that doesn't match the primary "Responses API everywhere" directive.

**Status**: **DEPRECATED / MISALIGNED**.
**Recommendation**: If OpenRouter support is still needed, it must be rewritten to map the new `maxCompletionTokens` interface correctly to `max_tokens` for the OpenRouter API, and validated against the new model Config.
