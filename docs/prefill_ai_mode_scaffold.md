# Prefill AI Mode Scaffold Plan

## 1. Objective
Enable switching between **MOCK** (current simulated delay) and **REAL** (LLM API based) modes for the prefill system without breaking existing functionality or UI performance.

---

## 2. Mode Definition & Config

We will introduce a centralized config source for AI Mode.

- **Modes**:
  - `mock`: Uses random delay + template strings. Safe, fast, free.
  - `real`: Connects to `src/ai/index.ts` client factory.

- **Config Priority**:
  1. `window.ARNVOID_AI_MODE` (Runtime override for DevTools)
  2. `import.meta.env.VITE_AI_MODE` (Build time / .env)
  3. Default: `'mock'`

---

## 3. Implementation Plan (Scaffold Only)

### Step A: Config Module
Create `src/config/aiMode.ts`:
```typescript
export type AiMode = 'mock' | 'real';

export function getAiMode(): AiMode {
    // 1. Runtime override
    if (typeof window !== 'undefined' && (window as any).ARNVOID_AI_MODE) {
        return (window as any).ARNVOID_AI_MODE as AiMode;
    }
    // 2. Env Var
    const envMode = import.meta.env.VITE_AI_MODE;
    if (envMode === 'real') return 'real';

    // 3. Default
    return 'mock';
}
```

### Step B: Refine Logic Fork (`src/fullchat/prefillSuggestion.ts`)

Update `refinePromptAsync` to branch based on mode.

```typescript
import { getAiMode } from '../config/aiMode';

export async function refinePromptAsync(context: PrefillContext, options: { signal?: AbortSignal }): Promise<string> {
   const mode = getAiMode();
   // Log for visibility
   console.log(`[Prefill] refine_starting mode=${mode}`);

   if (mode === 'real') {
       return refinePromptWithRealInternal(context, options);
   } else {
       return refinePromptMock(context, options);
   }
}

// Existing logic moved here
async function refinePromptMock(...) { ... }

// New placeholder stub
async function refinePromptWithRealInternal(context: PrefillContext, options: { signal?: AbortSignal }): Promise<string> {
    // SCAFFOLD: Not wired yet.
    // Simulate a network check or just fail gracefully for now.
    await new Promise(resolve => setTimeout(resolve, 500));

    // Throwing ensures we test the Store's error handling path immediately
    // OR return a "Real Mode Not Ready" string to verify path sans-error.
    // Decision: Return a safe string to prove wiring works without crashing UI.
    return "Real AI Mode Scaffolding: Wiring Complete (Not connected to LLM yet).";
}
```

---

## 4. Acceptance Checks

### 1. Mock Mode (Regression Test)
- Set `VITE_AI_MODE=mock` (or unset).
- Trigger Handoff.
- **Expected**: "Breath" phase -> Template prompt ("Synthesize...").
- **Log**: `[Prefill] refine_starting mode=mock`.

### 2. Real Mode (Scaffold Test)
- Set `VITE_AI_MODE=real`.
- Trigger Handoff.
- **Expected**: "Breath" phase -> "Real AI Mode Scaffolding: Wiring Complete..."
- **Log**: `[Prefill] refine_starting mode=real`.

---

## 5. Security & Risk Note

- **API Keys**: Real mode requires `VITE_OPENAI_API_KEY`. If missing, the real shim should identify this early and fall back to mock or return a specific error string ("Missing API Key").
- **Latency**: Real mode might take 2-3s. The `FullChatbar` "Breath" phase handles this natively. If it takes >3s, the Hard Timeout kick in. **No UI changes needed**.

---

## 6. Follow-up Questions for Integration

1. **Proxy vs Client**:
   - Current plan uses Client-Direct (`src/ai/*`). Are we sticking with this? (Exposes keys).
2. **Model Selection**:
   - Should prefill use a cheaper model (`gpt-4o-mini`) vs the main chat?
   - Can we add `VITE_PREFILL_MODEL` env var?
3. **Context Window**:
   - `MiniChatMessages` can be long. Do we need to truncate/summarize *before* sending to `refinePromptAsync` to save tokens?
