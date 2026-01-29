# Documentation Refresh: LLMClient & Single-SDK Architecture

**Date**: 2026-01-29
**Author**: Antigravity

## 1. Overview
This documentation refresh clarifies the role of `LLMClient` as the core interface of the system and outlines the future roadmap for unifying OpenAI and OpenRouter implementation under a single SDK usage pattern.

## 2. Key Insights
*   **LLMClient is King**: The application logic depends *only* on the `LLMClient` interface (`generateText`, `generateTextStream`, `generateStructured`), not on specific provider implementations.
*   **Single-SDK Future**: OpenRouter supports the standard OpenAI API format. We can leverage this to reduce our codebase footprint.
    *   **Old View**: Two separate client classes (`OpenAIClient`, `OpenRouterClient`) with divergent parsing and streaming logic.
    *   **New View**: One client class wrapper that configures the underlying SDK with different `baseURL` and `apiKey`.

## 3. Documentation Updates
The following files were updated to reflect this worldview:

### `docs/system.md`
*   **Added**: Section 3 ("AI Architecture") explicitly defining `LLMClient`.
*   **Clarified**: Current usage of `OpenAIClient` with the `Responses` API (`v1/responses`).
*   **Roadmap**: Documented the planned move to `https://openrouter.ai/api/v1` via the OpenAI SDK for provider unification.

### `docs/handoff.md`
*   **Neutralized**: Removed strict dependencies on "OpenAI" wording in troubleshooting sections.
*   **Generalization**: Referred to "Provider Keys" instead of implying only OpenAI keys exist.

### `AGENTS.md`
*   **Added**: Section 5 ("AI Doctrine").
*   **Rules**:
    *   Must use `v1/responses` for OpenAI.
    *   Must use `maxCompletionTokens` (not `maxTokens`).
    *   Must not use `temperature` with reasoning models.
*   **Future**: Documented the "Single SDK" refactor goal.

## 4. Next Steps (Future Refactor)
This task was purely documentation. The actual code refactor will involve:
1.  Verify if `OpenAI` Node SDK supports `v1/responses` natively or if we need to continue with `fetch` for that specific endpoint (likely the latter for now until SDK catches up).
2.  If `OpenAI SDK` is used for OpenRouter (via `chat.completions`), we need to ensure our internal `LLMClient` normalizes the output to match the `Responses` format we expect.
3.  Deprecate and remove `OpenRouterClient` class, replacing it with a configuration switch in the main client.
