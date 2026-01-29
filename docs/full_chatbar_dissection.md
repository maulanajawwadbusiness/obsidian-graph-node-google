# Full Chatbar Dissection & AI Wiring Report

This document details the architecture, design principles, and AI integration of the Full Chatbar reasoning panel.

## 1. Component Location & Owner
- **Main Component**: `src/fullchat/FullChatbar.tsx`
- **State Store**: `src/fullchat/FullChatStore.tsx` (React Context Provider)
- **Types**: `src/fullchat/fullChatTypes.ts`

## 2. Code Dissection: The "Void" Aesthetic & Performance
The Full Chatbar is designed for "Dark Elegance" and high-performance interaction.

### Aesthetic Foundation
- **The Void**: Uses a deep black gradient (`#08080c` to `#0c0c12`) to create a sense of depth rather than a flat gray panel.
- **Energy Accents**: Blue (`#56C4FF`) is used sparingly as "energy leaking through," symbolizing active reasoning.

### Performance & Interaction Hardening
- **Event Isolation**: The panel uses `onWheelCapture`, `onPointerDownCapture`, and `onContextMenu` with `stopPropagation()` to prevent interaction "bleed-through" to the graph canvas.
- **Uncontrolled Input**: The `textarea` is largely uncontrolled. During AI streaming and prefill transitions, the code writes directly to `textareaRef.current.value` and then syncs to React state in a deferred microtask. This avoids the 16ms overhead of React render cycles for character-by-character updates.
- **Anti-Jank Scrolling**: A `isUserNearBottomRef` tracks if the user is currently looking at the latest message. Automation only triggers `scrollIntoView` if this ref is true, preventing the UI from snatching scroll control while a user is reading history.

## 3. AI Wiring: The Prefill V4 State Machine
The most complex part of the chatbar is the prefill system, which uses a three-phase state machine to feel "alive."

### The Phases
1. **SEED (Instant)**: Immediately streams a heuristic prompt (e.g., "Tell me more about [Node]") using a 500ms cubic ease-out.
2. **BREATH (500ms)**: A intentional pause that simulates "thinking" and allows the model time to return the refined prompt.
3. **REFINE (Variable)**: Once the LLM returns a more specific prompt, it replaces the seed with a long, structured instruction if the user hasn't intervened.

### Logic Wiring
- **Run Authority**: `FullChatStore` maintains a `runId`. Every handoff (Mini Chat -> Full Chat) increments this ID. Async callbacks check `myRunId === currentRunId` to ensure stale responses from previous clicks never overwrite the current state.
- **Dirty Flag**: The `dirtySincePrefill` state is set the moment a user types. Once dirty, all automation (SEED/BREATH/REFINE) is instantly killed via `cancelEverything()`.
- **Client Factory**: The system uses `createLLMClient` (from `src/ai/index.ts`) pinning to `gpt-4o` for the refinement step.

### Fail-Safes
- **Hard Timeout**: A 3000ms `window.setTimeout` acts as a global watchdog. If the refined prompt doesn't arrive or the streaming stalls, the system "snaps" to the best available text (usually the seed) to ensure the input field is never left empty or broken.
- **Abort Support**: Uses `AbortController` linked specifically to the search/refine job.

## 4. AI Call Chain Summary
1. `receiveFromMiniChat` (Store) triggers.
2. `refinePromptAsync` (Util) is called with a new `runId` and `AbortSignal`.
3. `refinePromptWithReal` (Util) checks `getAiMode()`.
4. `OpenAIClient.generateText` (Client) executes the HTTP call.
5. `withTimeoutAndAbort` (Wrapper) enforces the 2.5s network limit.
6. `streamToText` (Component) executes the `requestAnimationFrame` loop to visually grow the prompt in the UI.
