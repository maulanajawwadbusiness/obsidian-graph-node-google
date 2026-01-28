# Handoff Context Preservation

**Date**: 2026-01-28
**Goal**: Ensure the rich "Node Knowledge" (Title + Summary) travels from MiniChat to FullChat during handoff.

## Changes
1.  **MiniChat**: Sends `content` in payload. (Done)
2.  **FullChatStore**: Receives `content`. (Done via types)
3.  **FullChatContext**:
    *   `AiContext` construction in `FullChatbar.tsx` currently looks at `documentStore` and `activeNode`.
    *   **Fix**: It must also respect `state.pendingContext.content` if available, or finding a way to lookup the node content if it's the active node.
    *   Since `pendingContext` is transient, we should ensure that when `FullChat` opens via handoff, the "Active" context reflects that specific node's data.

## Implementation Detail
In `FullChatbar.tsx`, `getAiContext()` builds the context.
We need to patch it to check `fullChatState.pendingContext?.content` and use it to populate `documentTitle` or a new `nodeSummary` field.
Currently `AiContext` has `nodeLabel`, `documentText`, `documentTitle`.
We can map `content.title` -> `documentTitle` (or `nodeLabel` context) and `content.summary` -> appended to prompt or `documentText`.

## Prefill Suggestion
`prefillSuggestion.ts` takes `MiniChatContext`. We can update `refinePromptAsync` to include the summary in its generation prompt for better prefill suggestions.
