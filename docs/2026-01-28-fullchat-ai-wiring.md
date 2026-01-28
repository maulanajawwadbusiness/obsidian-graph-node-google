# Full Chatbar AI Wiring (Real Conversation)

**Date**: 2026-01-28  
**Author**: Antigravity (AI)

## Overview
This update wires the Full Chatbar to the **Real AI Pipeline** by default. It enables context-aware conversations using the active `Node Label`, `Document Text`, and `Conversation History`. It includes robust handling for high-latency network requests (throttling, cancellation) without blocking the UI.

## Changes

### 1. Configuration
- **`src/config/aiMode.ts`**: Defaults to `'real'` mode.

### 2. New Logic: `src/fullchat/fullChatAi.ts`
- **Purpose**: Encapsulates the AI calling logic and context assembly.
- **Key Features**:
  - `generateResponseAsync`: An async generator that yields text chunks (simulated for now, ready for streaming).
  - `buildSystemPrompt`: Assembles a prompt with "Focused Node", "Active Document", and "History".
  - `mockResponseGenerator`: Deterministic fallback if API key is missing.

### 3. Store: `src/fullchat/FullChatStore.tsx`
- **Async Generation**: `sendMessage` now accepts `AiContext` and triggers the async generator.
- **Throttling**: Updates the UI state at roughly **30fps** (every ~32ms) to prevent React render thrashing during high-speed text updates.
- **Cancellation**: Automatically aborts the previous AI generation request if a new message is sent.

### 4. UI: `src/fullchat/FullChatbar.tsx`
- **Context Gathering**: In `handleSend`, the component gathers:
  - `nodeLabel` (from Physics Engine map)
  - `documentText` (from Document Store)
  - `activeHistory` (from Store)
- **Cleanup**: Removed the legacy `streamSimulator` (visual-only typing effect) in favor of the data-driven store stream.

## Testing Manual

### 1. Verify Real Context
1.  Ensure you have `VITE_OPENAI_API_KEY` in `.env`.
2.  Open a Document (e.g., upload a PDF).
3.  Click a Node in the graph to select it.
4.  Open the Full Chatbar.
5.  Type: "How does this node relate to the document?"
6.  **Expected**: The AI response (after a few seconds) should explicitly mention the **Node Label** and reference content from the **Document**.

### 2. Verify Mock Fallback
1.  Temporarily rename/remove your API key or disconnect network.
2.  Send a message.
3.  **Expected**: The AI response should be the deterministic mock message: *"Viewing node [Label]..."* or *"I see you're reading [Doc Title]"*.

### 3. Verify Cancellation
1.  Send a message "Test 1".
2.  Immediately send "Test 2".
3.  **Expected**: The "Test 1" AI stream should stop/never appear, and "Test 2" should be the active response.

## Risks & Notes
- **Streaming**: Currently, `client.generateText` awaits the full response before yielding. The "streaming" effect is simulated by the store updating from the generator, but the network request is still atomic (pending improvements to `LLMClient` for true streaming).
- **Token Limits**: We truncate document text to ~3000 chars in the prompt to avoid hitting context limits on smaller models.
