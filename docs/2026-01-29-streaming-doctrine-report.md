# Documentation: Future Streaming Architecture

**Date**: 2026-01-29
**Topic**: Streaming Doctrine & SDK Migration Plan

## 1. Overview
This report documents the "Doctrine Planting" task. We have established the rules for streaming implementation and laid out the plan for migrating to the official OpenAI SDK.

## 2. New Documentation

### A. `docs/2026-01-29-future-todo-sdk-streaming.md`
*   **Purpose**: A dedicated roadmap for moving from our current manual SSE parsing to `openai` SDK streaming.
*   **Key Design**:
    *   Use `openai.chat.completions.create({ stream: true })`.
    *   Iterate via `for await`.
    *   Maintain the `AsyncGenerator<string>` interface for the UI Store.

### B. `AGENTS.md` (Updated)
*   **Added**: Section 6 "Arnvoid Streaming Doctrine".
*   **Core Tenets**:
    *   **Source vs Pump Separation**: Clients yield data, Stores handle rendering.
    *   **No Semantic Smoothing**: The API client should not change the rhythm of the tokens.
    *   **Abort Correctness**: Strict usage of AbortSignal.

## 3. Why This Matters
As we prepare to integrate `gpt-5` deeper, relying on manual parsing of the `v1/responses` endpoint becomes risky. The official SDK will handle edge cases (like new event types or protocol shifts) better. This documentation ensures future developers know *why* the code looks like it does now (manual) and *where* it needs to go (SDK).

## 4. Verification
*   **Manual Scan**: Verified `AGENTS.md` contains the new section.
*   **Manual Scan**: Verified the TODO doc exists and references correct file paths (`src/ai/openaiClient.ts`, `src/fullchat/fullChatAi.ts`).
