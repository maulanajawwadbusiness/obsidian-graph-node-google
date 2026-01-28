# AI System Scan: Current State

## 1. AI Inventory Map

### Files & Modules
- **AI Client Factory**: `src/ai/index.ts`, `src/ai/clientTypes.ts`
  - Abstraction layer for LLM clients.
- **AI Implementations**: `src/ai/openaiClient.ts`, `src/ai/openrouterClient.ts`
  - Concrete client implementations using `statsig-unrelated` fetches.
- **Label Rewriter**: `src/ai/labelRewriter.ts`
  - **REAL AI Usage**: Calls OpenAI to generate 3-word sentence labels.
- **Prefill Logic**: `src/fullchat/prefillSuggestion.ts`
  - **MOCK**: Contains `makeSeedPrompt` and `refinePromptAsync` (simulated delay + robust string ops).
- **Stream Simulator**: `src/fullchat/useStreamSimulator.ts`
  - **MOCK**: Hook that reveals text character-by-character. Used in Full Chat for "thinking" effect.

### Components Invoking AI
- **`src/fullchat/FullChatStore.tsx`**:
  - Triggers `refinePromptAsync` (Mock) during the handoff process.
- **`src/fullchat/FullChatbar.tsx`**:
  - Uses `useStreamSimulator` (Mock) to display the "AI response" after a user sends a message.
- **`src/ai/labelRewriter.ts`**:
  - Exported utility function `makeThreeWordLabels` used presumably by graph logic (not fully traced in this scan, but inventory confirms capability exist).

---

## 2. Chat Pipelines

### Mini Chat Pipeline
- **Flow**: User types -> Messages stored in react state -> `onSend` prop.
- **State**: Strictly local to parent or `MiniChatbar` props.
- **AI**: None. It is a passthrough to collect context.

### Full Chat Pipeline (Handoff)
- **Flow**: `receiveFromMiniChat` -> `makeSeedPrompt` (Sync) -> `refinePromptAsync` (Async Mock).
- **Streaming**:
  - **Prefill**: Custom `requestAnimationFrame` loop in `FullChatbar.tsx`. manually updates textarea `value` for high-performance 60fps expansion.
  - **Chat Response**: `useStreamSimulator` hook. Uses `setInterval` to slice a static string and update state.

---

## 3. Prefill Refine Seam (Current State)

**Location**: `src/fullchat/FullChatStore.tsx`

**Mechanism**:
1. **Trigger**: `receiveFromMiniChat` action.
2. **Execution**:
   - Creates `AbortController`.
   - calls `refinePromptAsync(context, { signal })`.
3. **MOCK Implementation** (`src/fullchat/prefillSuggestion.ts`):
   - Waits random 150-400ms.
   - Returns a template string: `"Synthesize the discussion regarding [Node]..."`.
4. **Return**:
   - `runId` checked against current store `runId`.
   - If valid, updates store `prefill.refined` and status `ready`.

---

## 4. Cancellation & Ownership Model

The system uses a **Layered Authority Model** which is highly robust.

- **Run ID Authority**:
  - `FullChatStore` increments `runId` on every handoff.
  - `FullChatbar` ignores any updates/callbacks where `runId !== currentRunIdRef.current`.
  - **Reliability**: Excellent. Old async jobs cannot overwrite new state.

- **AbortController**:
  - Used in `FullChatStore` to explicitly kill the previous `refinePromptAsync` job when a new handoff occurs.
  - **Reliability**: Good standard practice, stops network waste.

- **User "Dirty" Flag**:
  - `FullChatbar` maintains `dirtySincePrefill` flag.
  - If `true`, ALL streaming, snapping, and refining stops immediately.
  - **Reliability**: Critical invariant. "User wins" is strictly enforced.

- **Unmount/Visibility**:
  - `isMountedRef` prevents React state updates on unmount.
  - `visibilitychange` listener snaps animation to end if tab is hidden (prevents rAF buildup).

---

## 5. Config & Secrets

### Current Config
- **Env**: `import.meta.env.VITE_OPENAI_API_KEY`
- **Usage**: Only in `src/ai/labelRewriter.ts`.
- **Exposed?**: Yes, this is a client-side app. The key is embedded in the build or accessible in browser memory.
- **Risk**: **High**. Anyone with the app can extract the key.
  - *Mitigation*: App likely meant for local use (Electron/Tauri?) or strictly trusted internal deployment.

### Backend status
- **Pure Client**: No proxy detected. Calls OpenAI directly via `fetch`.

---

## 6. Error Handling & Timeouts

### Network / Failures
- **Label Rewriter**: Has a 10s timeout wrapper. Returns original words on failure.
- **Prefill (Mock)**: No real errors possible currently.
- **Future Real Refine**:
  - Needs strict timeout (e.g. 3s).
  - On error, `FullChatStore` should likely just log and leave `refined` as null. The UI naturally handles this by staying in "Breath" (for a bit) or just sticking with "Seed".
  - **Recommendation**: Do not show error toasts for prefill failure. Just degrade gracefully to the seed prompt.

### UI Guardrails
- **Hard Timeout**: `FullChatbar` has a 3000ms "suicide timer" that forces the UI to a stable state if the async machinery gets stuck.

---

## 7. Performance Risk Notes

- **Refine Logic**:
  - **Risk**: If the real LLM returns a massive prompt, the `streamToText` duration (calculated based on length) might drag on too long.
  - **Mitigation**: `MAX_HEIGHT` (116px) constraint is already in place.
- **Streaming Loop**:
  - **Risk**: The custom `rAF` loop in `FullChatbar` is efficient, but we must ensure `refinePromptAsync` doesn't block the main thread (parse JSON in worker if huge? likely unnecessary for prompts).
- **Rerenders**:
  - `FullChatbar.tsx` is heavily optimized with refs. Adding Redux-like selectors or Context updates for every token of a real LLM response needs care. The current "mock stream simulator" updates state `onUpdate`, which causes rerenders. For a real high-frequency stream, this might need the same `rAF` treatment as Prefill.

---

## Recommended Seam for Real LLM

**`src/fullchat/prefillSuggestion.ts` -> `refinePromptAsync`**

This function is the perfect isolation point.
- **Input**: Clean context object.
- **Output**: `Promise<string>`.
- **Context**: It is already awaited and handled safely by the Store.

**Plan**:
1. Check `AI_MODE` (Mock/Real).
2. If Real, instantiate `createLLMClient`.
3. Call `client.generateText` with a "Summarize/Refine" system prompt.
4. Return string.

## Must-Not-Break Invariants
1. **RunId Authority**: Never let a slow LLM response overwrite a new context.
2. **User Dirty**: If user typed 'A', the LLM result MUST be discarded silently.
3. **60fps**: Real network requests must happen off the UI thread (fetch is async, so fine), but processing shouldn't hitch the `rAF` loop.
