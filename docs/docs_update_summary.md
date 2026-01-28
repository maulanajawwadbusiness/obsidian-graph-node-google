# Documentation Refresh & Model Switch: Summary

## 1. What Changed

### A. Prefill Model Switch
*   **Action**: Switched the `refinePromptWithReal` configuration from `gpt-5-nano` (placeholder) to **`gpt-4o-mini`**.
*   **Reason**: `gpt-4o-mini` is the current production-ready model for high-frequency, low-latency tasks like prefill refinement. `gpt-5-nano` requires a different API structure (Responses) not yet wired.
*   **Impact**: Real mode (`VITE_AI_MODE='real'`) now correctly targets a valid OpenAI model.

### B. Canonical Docs Refresh
*   **`docs/system.md`**: Totally rewritten to include the new **Full Chatbar**, **Prefill V4 State Machine**, and **Performance Doctrine (60fps)**.
*   **`docs/handoff.md`**: Updated with precise "Mini Chat -> Full Chat" payload schema and debugging checklists for common edge cases (stutter, ghosting).
*   **`AGENTS.md`**: Updated Developer Doctrine to emphasize "60fps Sacredness" and "Ownership Rules" for panels vs canvas.

## 2. System Map (Where to look)

| System | Key Files |
| :--- | :--- |
| **Full Chat Panel** | `src/fullchat/FullChatbar.tsx` |
| **Prefill Logic** | `src/fullchat/FullChatStore.ts`, `src/fullchat/prefillSuggestion.ts` |
| **AI Client** | `src/ai/openaiClient.ts` |
| **Handoff Trigger** | `src/popup/MiniChatbar.tsx` |

## 3. How to Enable Real AI Mode
1.  Set `VITE_AI_MODE='real'` in your `.env`.
2.  Set `VITE_OPENAI_API_KEY='sk-...'` in your `.env`.
3.  Restart the dev server.
4.  Click the "Extend to Main Chat" button in any node popup.
5.  Watch the console for `[Prefill] refine_starting mode=real model=gpt-4o-mini`.
