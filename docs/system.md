# Arnvoid System Documentation

## 1. Introduction
**Arnvoid** is a conversational graph interface designed for deep reasoning over complex knowledgebases. It acts as a "thinking partner" that lives inside the user's obsidian graph, providing context-aware synthesis and exploration.

Unlike standard chatbots, Arnvoid is:
*   **Anchored**: Every conversation starts from a specific node or context.
*   **Fluid**: It uses 60fps streaming and "living" text to feel like a continuous extension of thought.
*   **Dark**: It employs a rigorous "Void" aesthetic (near-black, #08080c) to minimize cognitive load and maximize focus.

## 2. UI Surface Map

The application consists of five primary layers, ordered by z-index (lowest to highest):

1.  **The Canvas (Graph)**
    *   The visual node-link diagram.
    *   **Rule**: Never under-reacts. If a panel is open, the canvas underneath should NOT receive pointer/wheel events.
    *   Owned by: `PhysicsEngine`.

2.  **Node Popups (Context)**
    *   Small floating cards that appear when hovering/selecting a node.
    *   Entry point for "Quick Actions" and "Handoff".
    *   Owned by: `PopupStore`.

3.  **Mini Chat (Quick Context)**
    *   A lightweight floating chat window adjacent to the popup.
    *   Used for quick clarifications without losing graph context.
    *   Contains the **Handoff Button** (Extend to Main Chat).

4.  **Full Chatbar (Deep Reasoning)**
    *   A dedicated right-side panel for long-form synthesis.
    *   **Ownership Rule**: When open, this panel CONSUMES all mouse/wheel interaction within its bounds. It must not let events bleed to the canvas.
    *   Contains the **Prefill V4 System**.

5.  **Document Viewer (Source)**
    *   A left-side panel for reading source markdown files.
    *   Toggled via node actions.

## 3. Performance Doctrine
We adhere to a sacred **60fps Rule**. Jitter, layout thrashing, and "heavy" feel are bugs.

*   **Avoid Rerender Cascades**: Use `useRef` for high-frequency data (like scroll positions or stream tokens). Sync to React state only when necessary (e.g. at the end of a stream).
*   **Throttle Layout Writes**: Never read `scrollHeight` and write `style.height` in the same frame without throttling. The Prefill system limits autosize to once per 50ms.
*   **Independent Animation Loops**: Streaming text uses its own `requestAnimationFrame` loop, decoupled from React's render cycle.

## 4. Chat Architecture & Handoff
The system is bifurcated into "Quick" and "Deep" modes.

### Mini Chat (Quick)
*   **Role**: Transient, context-bound query.
*   **State**: Local to the popup session.
*   **Handoff**: Can "graduate" a conversation to Full Chat to go deeper.

### Full Chat (Deep)
*   **Role**: Persistent, complex synthesis.
*   **State**: Global `FullChatStore`.
*   **Handoff Receiver**: When "Extend to Main Chat" is clicked:
    1.  Mini Chat sends history + node label.
    2.  Full Chat opens immediately.
    3.  **Prefill System** kicks in to generate a high-quality starting prompt.

## 5. Prefill System V4
A deterministic state machine that suggests the next best query.

### The "Thinking" Timeline
1.  **Seed (0-500ms)**: "In context of Node..."
    *   Instant feedback. Confidence anchor.
2.  **Breath (500-1000ms)**: "..."
    *   A deliberate pause to simulate thought and allow the AI refine step to complete.
3.  **Refine (>1000ms)**: "Synthesize the impact of X on Y..."
    *   The "Aha" moment. Streaming text expands based on the AI's suggestion.

### Critical Rules
*   **Dirty Wins**: If the user presses a single key, the prefill system **DIE** instantly. We never overwrite user intent.
*   **Cancellation**: A `runId` based authority model ensures that stale async requests (from spam-clicking handoff) are silently dropped.

## 6. AI System Architecture

Arnvoid uses a tiered AI approach.

*   **Mode Switch**: Toggled via `VITE_AI_MODE='real'` (or `'mock'`).
*   **Client**: `OpenAIClient` (Chat Completions API).
*   **Current Model**: `gpt-4o-mini` (for Refine step).
    *   Selected for speed/cost balance for the high-frequency prefill task.
*   **Safety**:
    *   **Timeouts**: Refine requests have a hard 2.5s timeout.
    *   **Fallback**: If AI fails or times out, the system degrades to a heuristic rule-based suggestion.
    *   **Keys**: Reads `VITE_OPENAI_API_KEY`.
