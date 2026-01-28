# Context Handoff Protocol

## 1. Definition
**Handoff** is the mechanism by which a conversation "graduates" from the transient Mini Chat popover to the persistent Full Chat reasoning panel.

It is triggered by the "Extend to Main Chat" action (diagonal arrow icon) in the Mini Chat interface.

## 2. Handoff Payload Schema
When the handoff is triggered, `MiniChatbar` constructs a payload and sends it to `FullChatStore`.

> **Contract**: The payload must be synchronous and serializable.

| Field | Type | Description |
| :--- | :--- | :--- |
| `nodeLabel` | `string` | The label of the currently focused node (e.g. "Biology"). Derived from `popupContext.selectedNodeId`. |
| `miniChatMessages` | `Array<{ role: 'user'\|'ai', text: string }>` | The full history of the current Mini Chat session. Used by the AI to understand context. |

### "Current Focus" Definition
The "Focus" is determined by the **Open Popup**, not necessarily the last clicked node. If a popup is open for Node A, and the user clicks Handoff from that popup's Mini Chat, the context is **Node A**.

## 3. Prefill Integration
The Full Chat system uses the Handoff Payload to drive the **Prefill V4** engine.

### Data Flow
1.  **Receive**: Store receives payload -> Generates `runId`.
2.  **Seed**: "In context of {nodeLabel}..." is generated immediately (0 latency).
3.  **Refine Packet**: The store constructs a prompt for the AI:
    *   *Input*: Node Label + Last ~4 messages of Mini Chat history.
    *   *Sanitization*: Truncates very long history to fit token limits.
    *   *Output*: A single-sentence prompt suggestion.

## 4. UI/UX Requirements
The handoff must feel physical and deliberate.

*   **No Badges**: We do not use "NEW" or "Context" chips. The text itself ("In context of...") carries the meaning.
*   **No Brick Replacement**: The input field text must not "snap" or blink into existence. It must stream in character-by-character (60fps).
*   **Breath is Intentional**: The system pauses after the Seed phase. This is not lag; it is a design choice to convey "thinking" and allow the Refine step to complete naturally.

## 5. Debugging Checklist

If Handoff feels broken or janky, check these:

### A. "The Stutter" (Layout Thrashing)
*   **Symptom**: The chatbar frame drops during streaming.
*   **Fix**: Check `FullChatbar.tsx`. Ensure autosize logic is throttled (`now - lastResizeTime > 50`).

### B. "The Ghost" (Overwriting)
*   **Symptom**: User text gets replaced by AI text while typing.
*   **Fix**: Check `dirtySincePrefill`. The `handleInputChange` handler must set this flag immediately on any user keystroke.

### C. "The Zombie" (Stale Refs)
*   **Symptom**: Clicking Handoff 5x results in flickering text or mixed messages.
*   **Fix**: Check `runId`. The `streamToText` loop must abort if `targetRunId !== currentRunId`.

### D. "The Void" (No Refine)
*   **Symptom**: Seed streams, then... nothing.
*   **Fix**: Check AI Mode. If `VITE_AI_MODE=real` but no API key is present, it should fallback to Mock. Check console for `[PrefillError]`.

## 6. Logs to Watch
Filter console for `[Prefill]`:

*   `[Prefill] run_start runId=105` -> Healthy start.
*   `[Prefill] phase seed runId=105` -> Animation start.
*   `[Prefill] refine_ready runId=105` -> AI response arrived.
*   `[Prefill] cancel reason=user_dirty` -> User took over.
