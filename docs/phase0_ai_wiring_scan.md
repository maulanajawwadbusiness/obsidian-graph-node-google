# Phase 0: Deep Scan & Dissect Report

## 1. Full Chatbar Architecture

- **Owners**:
  - **Component**: `src/fullchat/FullChatbar.tsx` (UI, Event Handling, Scroll Logic)
  - **Store**: `src/fullchat/FullChatStore.tsx` (State: messages, isOpen, prefill status)
  - **Types**: `src/fullchat/fullChatTypes.ts`
- **Data Flow**:
  - Messages are stored in `state.messages` array.
  - Roles: `'user' | 'ai'`.
  - Status: `'sending' | 'sent' | 'streaming' | 'complete'`.
- **Send Handling**:
  - Triggered in `FullChatbar.tsx` via `handleSend` (Enter key or Button click).
  - Calls `fullChat.sendMessage(text)` which appends the User message and a skeleton AI "streaming" message.
- **Scroll Logic**:
  - `safeScrollToBottom` in `FullChatbar.tsx` respects `isUserNearBottomRef` to avoid jank.
- **Prefill V4**:
  - Lives inside `FullChatbar.tsx` as a `useCallback`/`useEffect` state machine.
  - Writes directly to `textareaRef.current.value` for 60fps performance during "breathing" and "streaming".

## 2. Context Sources (Taps)

We need to inject these into the system prompt.

### A. Node Context
- **Source**: `usePopup()` hook from `src/popup/PopupStore.tsx`.
- **Access**:
  ```typescript
  const { selectedNodeId, isOpen } = usePopup();
  // To get Label:
  const nodeLabel = engineRef.current?.nodes.get(selectedNodeId)?.label;
  ```
- **Fallback**: If `!isOpen`, checks `FullChatStore.pendingContext` (handoff data).

### B. Document Context
- **Source**: `useDocument()` hook from `src/store/documentStore.tsx`.
- **Access**:
  ```typescript
  const { state: docState } = useDocument();
  const doc = docState.activeDocument;
  // doc.content (full text)
  // doc.fileName
  // doc.meta (wordCount, etc)
  ```

## 3. Existing AI Primitives

We must reuse these exact patterns:

- **Mode**: `getAiMode()` from `src/config/aiMode.ts`.
- **Client Factory**: `createLLMClient` from `src/ai/index.ts`.
- **Timeout/Abort**: `withTimeoutAndAbort` from `src/fullchat/prefillSuggestion.ts`.
- **Logging**: Console tags `[FullChatAI] ...`.
- **Instantiation**: Per-call `createLLMClient(...)` inside the async action.

## 4. Hot Paths (No Network)

- **Do NOT touch**:
  - `streamToText` loop in `FullChatbar.tsx` (strictly for visual text growth).
  - `render` loop in `useGraphRendering.ts`.
  - `tick` loop in `PhysicsEngine`.

## 5. Recommended Integration & wiring plan

We will add a new action `generateResponseAsync` to `src/fullchat/FullChatStore.tsx` (or a dedicated `fullChatAI.ts` util called by the store).

**Pipeline**:
1. `handleSend` (Component) -> calls `sendMessage(text)` (Store).
2. Store updates state (User: sent, AI: streaming).
3. Store triggers side-effect `generateAiResponse(...)`.
4. `generateAiResponse` gathers context (Node + Doc), builds prompt, calls `createLLMClient`.
5. On chunk/completion, it calls `updateStreamingMessage(text)` (Store).
   - *Note*: We defined "Do not stream tokens via react state per-char".
   - *Refined Plan*: We will use a ref-based accumulator in the component or a throttled store update for the long streaming response to keep React renders low (e.g., update every 50ms or on chunk groups), or strictly use the existing `streamSimulator` visualizer but fed by real chunks?
   - *Guidance*: The user wanted "Real" conversation. Real streaming implies network chunks. The existing `streamSimulator` is for fake "typing" effect. We should feed the **real** chunks into the `updateStreamingMessage` but throttle the React state updates to ~30-60fps.

**Safe AI Recipe (Code Snippet)**:
```typescript
async function generateResponse(prompt, signal) {
  const client = createLLMClient(...);
  return await withTimeoutAndAbort(
    client.generateText(prompt, ...),
    15000, // Longer timeout for full chat
    signal
  );
}
```
