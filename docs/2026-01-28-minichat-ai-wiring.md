# MiniChat AI Wiring & Context Handoff

**Date**: 2026-01-28
**Goal**: Connect MiniChat to real AI and ensure context preservation during handoff.

## Architecture Changes

### 1. PopupStore (The Brain)
*   **Current**: `sendMessage` mocks response.
*   **New**: `sendMessage` calls `fullChatAi.generateResponseAsync`.
*   **Streaming**: Implements a localized streaming loop (updating `messages` state in real-time).
*   **Context**: Injects `state.content` (Title + Summary) into the system prompt.

### 2. FullChatTypes (The Contract)
*   **Change**: Update `MiniChatContext` to include optional `content` field.
    ```typescript
    export interface MiniChatContext {
        // ... existing
        content?: { title: string; summary: string } | null;
    }
    ```

### 3. Handoff (The Bridge)
*   **Source**: `MiniChatbar` passes `popupContext.content` to `receiveFromMiniChat`.
*   **Dest**: `FullChatStore` receives `content` but currently ignores it for logical grounding (it typically uses `activeDocument`).
*   **Improvement**: We will verify `FullChatStore` stores this pending context.

## Wiring Plan
1.  **Update Types**: `fullChatTypes.ts` add `content` to `MiniChatContext`.
2.  **Update Store**: `PopupStore.tsx` import `generateResponseAsync` and implement the loop.
3.  **Update UI**: `MiniChatbar.tsx` pass content in handoff.

## Fallback Strategy
If AI fails/timeouts, `PopupStore` will catch error and append a "mock fallback" message to ensure the UI doesn't stall.
