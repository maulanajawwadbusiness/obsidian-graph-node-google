# Prefill Real AI Wiring (GPT-5-Nano)

## 1. Overview
The prefill refinement system now supports a **Real AI** mode using `gpt-5-nano`. This replaces the mock simulation with a live call to the LLM API when enabled.

## 2. Configuration & Enabling
The system defaults to `mock` mode to ensure dev stability and zero cost.

### To Enable Real Mode:
1. **Environment Variable**: Set `VITE_AI_MODE=real` in `.env`.
2. **Runtime Override**: Set `window.ARNVOID_AI_MODE = 'real'` in the browser console (useful for A/B testing or dev debugging).

**Prerequisite**: `VITE_OPENAI_API_KEY` must be present. If missing, the system warns and falls back to mock.

## 3. Implementation Details

### Module: `src/fullchat/prefillSuggestion.ts`
- **Logic**: `refinePromptAsync` checks the mode.
- **Model**: `gpt-5-nano` (via `createLLMClient`).
- **Context Packet**: Truncated summary of the last 4 mini-chat turns + Node Label.
- **System Prompt**: Enforces "Dark Elegant" tone, max 160 chars, no quotes.

### Safety & Invariants
- **Hard Timeout**: **2500ms**. If the LLM is slow, we abort and fall back to mock to ensure the UI feels snappy.
- **Dirty Wins**: If the user types before the LLM returns, the result is silently discarded (handled by `FullChatStore`).
- **Cancellation**: A new handoff instantly aborts the previous network request to save bandwidth and prevent race conditions.
- **Graceful Fallback**: Any network error, timeout, or empty response silently degrades to the "Mock" behavior (or just the Seed prompt), ensuring the user never sees a broken state.

## 4. Sample Logs
**Real Mode Success:**
```
[Prefill] refine_starting mode=real model=gpt-5-nano
[FullChat] refine_ready runId=15 len=42
```

**Missing Key:**
```
[PrefillAI] missing VITE_OPENAI_API_KEY, falling back to mock
```

**Timeout/Failure:**
```
[PrefillAI] real refine failed or timed out, falling back to mock Error: Timeout
```
