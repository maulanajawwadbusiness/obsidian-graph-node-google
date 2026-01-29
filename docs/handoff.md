# Context Handoff Protocol

## 1. Definition
**Handoff** is the mechanism by which a conversation "graduates" from the transient Mini Chat popover to the persistent Full Chat reasoning panel.

It is triggered by the "Extend to Main Chat" action (diagonal arrow icon) in the Mini Chat interface.

## 2. Handoff Payload Schema (V2)
When the handoff is triggered, `MiniChatbar` constructs a payload and sends it to `FullChatStore.receiveFromMiniChat(payload)`.

| Field | Type | Description |
| :--- | :--- | :--- |
| `nodeLabel` | `string` | The label of the currently focused node. |
| `miniChatMessages` | `Array<{ role: 'user'\|'ai', text: string }>` | The full history of the current Mini Chat session. |
| `content` | `{ title: string, summary: string } \| null` | **Enriched context**. Contains the AI-distilled essence of the node. |

## 3. Propagation & Authority
The `FullChatStore` stores this as `pendingContext`.

### Context Preservation Logic
In `FullChatbar.tsx`, the `handleSend` function follows this priority:
1.  **Handoff Priority**: If `pendingContext.content` exists, use that `title` as the reasoning anchor and the `summary` as the foundational text.
2.  **Document Fallback**: If no handoff exists, fall back to the generic `activeDocument` text.

### Prefill V4 Integration
*   The **Refine Packet** builder (`prefillSuggestion.ts`) now consumes the `content` field.
*   The AI uses the `summary` to generate a much more relevant "next step" suggestion than just looking at the node label.

## 4. UI/UX Requirements
*   **Zero Jitter**: Autosize logic in `FullChatbar` must be throttled.
*   **Breath is Intentional**: The 500ms pause during prefill allows the `refinePromptAsync` call (LLM) to complete so it can stream the finished suggestion.
*   **Handoff Visibility**: When a handoff happens, the `FullChatbar` header/badge should reflect the node being discussed.

## 5. Troubleshooting (Forensic Checklist)

### A. "The Drift" (Ignored Knowledge)
*   **Symptom**: You hand off a summary about "Photosynthesis", but the chat starts talking about the whole generic biology document.
*   **Fix**: Check `FullChatbar.tsx > getAiContext()`. Ensure it is checking `fullChat.pendingContext?.content?.summary` before `documentState.activeDocument`.

### B. "The Zombie" (Stale Context)
*   **Symptom**: You hand off Node A, close it, then hand off Node B, but it still shows Node A's title.
*   **Fix**: The `receiveFromMiniChat` action must overwrite the previous context. Check `FullChatStore.tsx`.

### C. "The Dirty Wipe"
*   **Symptom**: Clicking handoff doesn't show the prefill suggestion.
*   **Fix**: Check if `setDirtySincePrefill` was triggered by a stray keyboard event. User input always kills the prefill machine.

### D. "The Void"
*   **Symptom**: AI is in 'real' mode but isn't responding.
*   **Fix**: Check `VITE_OPENAI_API_KEY` and the `withTimeoutAndAbort` log in `prefillSuggestion.ts`.

## 6. Logs to Watch
Filter for `[MiniChatAI]` and `[Prefill]`:
*   `[MiniChatAI] send_start` -> Mini Chat is alive.
*   `[Prefill] phase seed` -> Handoff received, animation starting.
*   `[Prefill] refine_ready` -> AI context has arrived at the boundary.

