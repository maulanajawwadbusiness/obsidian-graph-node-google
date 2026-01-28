# Deep Forensic Scan: MiniChat Architecture

**Date**: 2026-01-28
**Subject**: MiniChat System & AI Integration Status

## 1. System Overview
The **MiniChat** is a transient, context-aware chat overlay attached to individual nodes. Unlike the global **FullChat**, it is ephemeral (lives only while the popup is open) and focused on "this specific node".

## 2. Component Architecture
-   **Host**: `src/popup/MiniChatbar.tsx`
    -   **Role**: UI Container.
    -   **Positioning**: Calculates optimal specific adjacent position to `NodePopup`.
    -   **Sub-components**: `ChatInput` (User Input), `message` list (UI).
    -   **Handoff**: Contains specific logic to package history and send it to `FullChat`.

-   **State Manager**: `src/popup/PopupStore.tsx`
    -   **Role**: Logic & State.
    -   **State**: Holds `messages[]`, `isOpen`, `selectedNodeId`, and crucially `content` (Title+Summary from the Analyzer).
    -   **Current Logic**: `sendMessage` is a **Mock Stub**. It immediately pushes a hardcoded hard-coded string.

-   **Input**: `src/popup/ChatInput.tsx`
    -   **Role**: Auto-expanding text area.
    -   **Status**: Healthy.

## 3. Data Flow & Handoff
1.  **User types** in MiniChat.
2.  **UI** calls `onSend` -> `PopupStore.sendMessage`.
3.  **Store** currently mocks response.
4.  **User clicks Handoff** (Arrow Icon):
    -   `MiniChatbar` calls `fullChat.receiveFromMiniChat`.
    -   **Payload**: `{ miniChatMessages, nodeLabel }`.
    -   **Result**: FullChat opens, creates a "Seed" (Prefilled prompt), and continues the session.

## 4. The "Missing Link" (AI Wiring)
The system is mechanically sound but brain-dead.
-   **Missing**: `PopupStore` does not call `FullChatAi` or any LLM client.
-   **Available Context**: 
    -   `state.content.title` (The Point Title)
    -   `state.content.summary` (The Point Summary)
    -   `state.selectedNodeId` (The Node ID)
-   **Required Action**:
    1.  Import `generateResponseAsync` (or similar) into `PopupStore`.
    2.  Update `sendMessage` to trigger an async generation loop.
    3.  Inject the `state.content` as context for the system prompt.

## 5. Risk Assessment
-   **Concurrency**: MiniChat is simple. Risk is low.
-   **Context Loss**: Currently `receiveFromMiniChat` only sends `nodeLabel` and `messages`. It **loses** the `content` (Summary) during handoff. This must be fixed in the upcoming wiring phase.

## 6. Conclusion
The "Body" is ready (UI, Animations, Handoff Buttons). The "Brain" is missing.
**Next Task**: Wire `PopupStore` to the AI client and pass the rich Node Knowledge (`content`) during Handoff.
