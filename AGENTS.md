# AGENTS.md: Developer Doctrine

**Welcome, Agent.**
This file outlines the sacred laws of the Arnvoid project. Read it before touching code.

## 1. The Doctrine

### A. 60fps Is Sacred
Jitter, layout thrashing, and frame drops are critical bugs.
*   **Never** block the main thread.
*   **Never** put expensive logic in a render loop.
*   **Throttle** all scroll/resize handlers.

### B. Panels Own Integration
The Canvas (Graph) is the substrate. Panels (Chat, Docs) float above it.
*   **Rule**: When a panel is open, it must own 100% of the input events within its rect.
*   **Anti-Pattern**: Scrolling a chat window causing the 3D graph to zoom is a failure.

### C. Minimal Diffs
*   Touch only what is necessary.
*   Prefer "surgical" refs over wide-sweeping state changes.
*   If a file is working, assume it contains subtle fixes you don't understand yet (Chesterton's Fence).

## 2. Project Map

| Domain | Path | Description |
| :--- | :--- | :--- |
| **Physics/Graph** | `src/physics/` | The ForceAtlas2 engine and WebGL renderer. |
| **Full Chat** | `src/fullchat/` | The deep reasoning panel (`FullChatbar.tsx`). |
| **Mini Chat** | `src/popup/` | The quick-context popover (`MiniChatbar.tsx`). |
| **AI Client** | `src/ai/` | OpenAI/LLM clients and prompt logic. |
| **Store** | `src/**/Store.ts` | Zustand stores for global state (Popup, Chat). |

## 3. Safe Workflow

1.  **Scan**: Read `docs/system.md` and related code first. Do not guess.
2.  **Dissect**: Identify the "load-bearing" logic (runIds, refs).
3.  **Implement**: Make small, verifiable changes.
4.  **Verify**: Check the console for logs.
5.  **Docs**: Update the relevant `docs/*.md` file.
6.  **Commit**: Use compact messages (`feat(chat): description`).

## 4. WARNINGS

### ⛔ DO NOT Use `task_boundary`
The task boundary tool is currently unreliable for complex state tracking in this environment. Manage your own context.

### ⛔ DO NOT Use IDE Browser Testing Tool
It is broken. Rely on mental mode code analysis and manual verification instructions for the user.

### ⛔ DO NOT Break The "Dot"
In the graph, we render "Dots", not "Nodes". The distinction matters for the renderer performance. Keep the terminology consistent.
