# Scan & Dissect: Chatbar, Prefill, AI Changes

## 1. Major Features & Changes

### A. Full Chatbar Panel
*   **Description**: A right-docked, "dark elegance" reasoning panel that replaces the old floating prefill window. It uses a "void" aesthetic (near-black) with subtle energy accents.
*   **Key Files**:
    *   `src/fullchat/FullChatbar.tsx`: The main visual component. Handles rendering, layout, and event propagation stops (so scrolling the bar doesn't zoom the canvas).
    *   `src/fullchat/FullChatStore.ts`: Manages visibility state (`isOpen`) and prefill data.
*   **Invariants**:
    *   Panel must capture `wheel` and `mousedown` events to prevent canvas bleed-through.
    *   Must respect `zIndex: 500` to sit above the canvas but below some popups.
    *   Height is 100% of the container.

### B. Smooth Conversation Experience
*   **Description**: A set of rendering and streaming behaviors designed to make the chat feel "alive" and "fluid" rather than janky or mechanical.
*   **Key Files**:
    *   `src/fullchat/FullChatbar.tsx`: Contains the `streamToText` logic.
*   **Features**:
    *   **Throttled Autosize**: Textarea height recalculation is limited to once per 50ms during streaming to prevent layout thrashing.
    *   **Anti-Jank Scroll**: Streaming updates trigger `safeScrollToBottom` which checks `isUserNearBottomRef` before seizing control.
    *   **Uncontrolled Input**: The textarea is largely uncontrolled during streaming for performance, syncing to React state only at key boundaries.

### C. Prefill System V4 (Robust State Machine)
*   **Description**: A deterministic state machine for "confident thinking".
*   **Phases**:
    1.  `SEED`: "In context of Node..." (500ms easing).
    2.  `BREATH`: Pause (500ms).
    3.  `REFINE`: Long structured prompt (variable duration).
*   **Key Files**:
    *   `src/fullchat/FullChatbar.tsx`: Implements the `phaseRef` state machine.
    *   `src/fullchat/FullChatStore.ts`: Managing the async `refinePromptAsync` job and run ID generation.
*   **Invariants**:
    *   **Run ID Authority**: Every new handoff increments `runId`. All async callbacks check `currentRunId === targetRunId` before acting.
    *   **Dirty Wins**: If `dirtySincePrefill` is true (user typed), all automation dies instantly.
    *   **Fail-Safes**: Hard timeout (3000ms), try/catch guards in rAF loops.

### D. AI Wiring (Real vs Mock)
*   **Description**: A toggleable system to switch between local heuristics (Mock) and live LLM calls (Real) for the refine step.
*   **Key Files**:
    *   `src/fullchat/prefillSuggestion.ts`: The entry point. Checks `getAiMode()`.
    *   `src/config/aiMode.ts`: Reads `VITE_AI_MODE` (real/mock).
    *   `src/ai/openaiClient.ts`: The production client.
*   **Current Model**: `gpt-4o-mini` (hardcoded in `prefillSuggestion.ts` for real mode, though a `gpt-5-nano` comment exists).
*   **Wiring**:
    *   Mock: Simulates network delay (150-400ms) and returns heuristic string.
    *   Real: Calls OpenAI ChatCompletions. Uses `VITE_OPENAI_API_KEY`.

### E. Handoff (Mini Chat -> Full Chat)
*   **Description**: The "Extend to Main Chat" button in the Mini Chat popup.
*   **Payload**:
    *   `nodeLabel`: string
    *   `miniChatMessages`: Array of history.
*   **Key Files**:
    *   `src/popup/MiniChatbar.tsx`: The button and payload construction.
    *   `src/fullchat/FullChatStore.ts`: The receiver `receiveFromMiniChat`.

## 2. Current Truth: Model & API

*   **Client**: `OpenAIClient` (Chat Completions API).
*   **Current Model Code**:
    *   `src/fullchat/prefillSuggestion.ts`: Explicitly uses `gpt-4o-mini` in `refinePromptWithReal`.
    *   `src/ai/labelRewriter.ts`: Also seemingly uses `gpt-4o-mini`.
*   **Env Vars**:
    *   `VITE_AI_MODE`: 'real' or 'mock' (default).
    *   `VITE_OPENAI_API_KEY`: Required for real mode.

## 3. Doc Delta Checklist

| Doc | Outdated Content | Update Needed |
| :--- | :--- | :--- |
| **system.md** | Missing Full Chatbar, Prefill V4 details. Likely references old prefill window. | Add "Arnvoid", new UI surfaces, Ownership Rule, Prefill V4 State Machine, AI System details. |
| **handoff.md** | Likely missing precise payload schema and fail-safe/debugging checklists. | Update schema, add "Current Focus" concept, document Breath/Refine UI/UX rules. |
| **AGENTS.md** | Needs the "Doctrine" refresh and safety warnings. | Update Agent Doctrine (60fps, etc), Project Map, Safe Workflow, and Warnings commands. |
