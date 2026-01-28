# Prefill Input System: Architectural Overview

## 1. Purpose & UX Contract
The Prefill Input System manages the transition from **Mini Chat** (contextual popup) to **Full Chat** (deep reasoning side panel). Its goal is to provide a "living" handoff where the system appears to be actively thinking about the user's current context.

### The "Confident Thinking" Feel:
1. **Seed**: Instant, confident start (e.g., "In context of Logic Node..."). Shows the system understood the anchor.
2. **Breath**: A brief pause ("...") where refined reasoning happens.
3. **Refine**: The "Aha!" moment where the prompt expands into a rich, structured query.

### Non-Negotiables:
- **User Wins**: Any manual typing immediately kills the prefill and keeps the user's text.
- **No Ghosting**: Old runs never overwrite new runs.
- **No Jank**: 60fps streaming, even during window resizes or scroll events.

---

## 2. End-to-End Flow
1. **Trigger**: User clicks the "Expand" (Handoff) button in `MiniChatbar`.
2. **Payload Generation**: `MiniChatbar` gathers:
   - Node Label (the anchor).
   - Summary of Mini Chat history.
   - Popup context (selected text, etc.).
3. **Store Entry**: `FullChatStore` receives the payload, generates a unique `runId`, sets the `seed` text, and triggers an async `refinePromptAsync` job.
4. **Visual Controller**: `FullChatbar` detects the new `runId` via an effect and begins the phase-based streaming loop.

---

## 3. State Machine & Timeline

```text
Phases: [ SEED ] -> [ BREATH ] -> [ REFINE ] -> [ IDLE ]
Time:   0ms       500ms        1000ms       (Varies)
Input:  "In context..."  "..."        "Refined..."  Stable
```

- **Seed Phase**: (500ms) Fixed duration easing. Snaps to 1-line height.
- **Breath Phase**: (500ms) Pause. Displays "..." if refine isn't ready.
- **Refine Phase**: (Variable 700-1200ms) Smoothly expands textarea up to 5 lines.
- **Late Refine**: If the refine job takes > 1000ms, the system stays in "Breath" until it arrives.
- **Early Refine**: If refine arrives during "Seed", it is cached and starts immediately after "Breath".

---

## 4. Cancellation & Ownership Rules
We use a **Layered Authority** model to ensure determinism:

### Run ID Authority
- Every handoff increments `runId`.
- Every async return or loop tick checks `currentRunIdRef.current === targetRunId`.
- Stale runs are silently dropped.

### Ref-Based Controls
- **`streamTokenRef`**: Incremented on every new stream start; kills any zombie `requestAnimationFrame` ticks.
- **`isProgrammaticSetRef`**: A guard that prevents the `onChange` handler from treating streaming updates as user typing.
- **`isMountedRef`**: Prevents `setState` on unmounted components (e.g., closing the panel mid-stream).

### User Takeover (Dirty State)
- If the user types, `dirtySincePrefill` becomes `true`.
- All visual processes (rAF, timers, pauses) instantly abort.
- The system will **never** write to the input again until a completely new `runId` is issued.

### Fail-Safes
- **Hard Timeout**: Every run has a 3000ms "suicide timer". If it hasn't metadata'd naturally, it snaps to the best available state and ends.
- **Try/Catch Guard**: The rAF tick is wrapped to catch DOM or logic errors, snapping to stable on failure.

---

## 5. Performance Budget & Guardrails (Dev Logs)
We track performance via `perfCountersRef` and log summaries at the end of each phase.

| Metric | Target / Budget | Example Log Line |
| :--- | :--- | :--- |
| **Tick Cost** | < 8ms (Avg < 1ms) | `[PrefillPerf] phase=seed updates=32 maxTickMs=0.45` |
| **Seed Updates** | ~30-40 ticks | `[PrefillPerf] phase=refine updates=85 maxTickMs=1.12` |
| **Autosize Calls** | 0 during Seed | `[PrefillRun] runId=102 end=refined` |
| **Scroll Jumps** | 0 driven by prefill | `[AutoScroll] ignore reason=userAway` |

---

## 6. Layout & Visual Interaction

### Textarea Sizing
- **Phase Seed**: Height is locked to `MIN_HEIGHT` (1 line) to prevent jitter.
- **Phase Refine**: Height expands via **Throttled Autosize** (max 1 recalculation per 50ms).
- **Constraint**: `overflowY: hidden` is enforced; text expands up to 5 lines then stops (no scrollbar).

### Visibility & Resize
- **Tab Hidden**: Streaming stops and "Snaps" to the final text immediately to avoid browser throttling glitches.
- **Window Resize**: Streaming yields immediately and snaps. A final height re-calc runs 150ms after resizing stops.

---

## 7. File Map

- **`src/fullchat/FullChatbar.tsx`**: The core controller. Contains the state machine, rAF loops, and event listeners.
- **`src/fullchat/FullChatStore.ts`**: Owns the prefill data state and the async refine job trigger.
- **`src/popup/MiniChatbar.tsx`**: The entry point. Sends the context payload to the store.
- **`docs/`**: Detailed hardening logs for Scroll, Resize, Races, and Fail-safes.

---

## 8. Future Seams: Real LLM Integration
Currently, `refinePromptAsync` uses a mock generator.
- **Seam**: Swap `mockRefineGenerator` for a real API client.
- **Invariants**: The real client must return a `Promise<string>`. The `FullChatbar` logic remains agnostic of where the refined text comes from.
- **UX**: The "Breath" phase naturally handles the network latency of a real LLM.

---

## 9. Known Limitations
- **Multi-Window**: Prefill is currently tied to a single instance of the Store.
- **Textarea Limit**: The 5-line limit is hardcoded; very long refined prompts will be visually clipped but remain in the text value.
- **Rich Text**: Only supports plain string prefilling.
