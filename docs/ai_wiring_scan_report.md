# AI Wiring Scan & Dissect Report

This report summarizes the current state of AI wiring in the Arnvoid repository, identifying infrastructure, safe patterns, and integration points.

## 1. Baseline: Current Infrastructure
The repository adheres to a centralized AI client architecture. No drift from the documented guide was found.

- **Client Factory**: `src/ai/index.ts` (`createLLMClient`)
- **OpenAI Implementation**: `src/ai/openaiClient.ts`
- **Active Call Sites**:
    - `src/fullchat/prefillSuggestion.ts`: Manages the V4 "thinking" state machine.
    - `src/ai/labelRewriter.ts`: Evocative 3-word phrase generation.
- **Config Resolver**: `src/config/aiMode.ts` (`getAiMode`)

## 2. The Shared "Safe Pattern"
Any new AI feature must follow this wiring doctrine to maintain stability and performance:

### Wiring Recipe
1. **Mode Resolution**: Use `getAiMode()` to respect environment (`VITE_AI_MODE`) and runtime (`window.ARNVOID_AI_MODE`) overrides.
2. **Mock First**: Implement a local heuristic fallback (e.g., `featureMock`) with simulated latency (150-400ms).
3. **Environment Safety**: Check for `VITE_OPENAI_API_KEY`. If missing in `real` mode, log a `[Feature] missing key` warning and drop back to the mock implementation.
4. **Resilience**: 
    - Use `withTimeoutAndAbort` (from `prefillSuggestion.ts`) to wrap all network calls.
    - Provide an `AbortSignal` to ensure stale requests (e.g., from a quick UI change) are cancelled.
5. **Output Hygiene**: 
    - Sanitize all raw results (strip markdown backticks, quotes, and excessive whitespace).
    - Hard-truncate strings to fit UI contracts using a `sanitizeOutput` helper.
6. **Logging**: Use tagged console outputs (e.g., `[Prefill]`, `[PrefillError]`) for rapid debugging in the browser console.

## 3. Performance Constraints: "No-Go Zones"
AI calls (which are high-latency network requests) are strictly prohibited inside the following "hot paths" to maintain 60FPS:

- **Rendering Loops**: `render()` in `src/playground/useGraphRendering.ts`.
- **Streaming Logic**: `tick()` in `src/fullchat/FullChatbar.tsx`.
- **PDF Render Queue**: Hooks in `src/ArnvoidDocumentViewer/engines/PdfEngine/pdf-viewer/hooks/`.

**Safe Zones**:
- Store actions (Zustand/Context actions).
- Button click handlers.
- Post-parsing callbacks (e.g., after `WorkerClient` completes a job).

## 4. Reusable Helpers
| Helper | Path | Usage |
| :--- | :--- | :--- |
| `getAiMode` | `src/config/aiMode.ts` | Resolving mock vs. real. |
| `withTimeoutAndAbort` | `src/fullchat/prefillSuggestion.ts` | Standardized timeout/abort wrapper. |
| `createLLMClient` | `src/ai/index.ts` | Primary factory for LLM access. |
| `sanitizeOutput` | `src/fullchat/prefillSuggestion.ts` | Logic for cleaning model noise. |

## 5. Integration Suggestions
For the upcoming wiring work, the following integration sites are recommended:

- **Triggered by UI**: Implement in `FullChatbar.tsx` as a scoped async function.
- **Triggered by State**: Implement in `FullChatStore.tsx` using the `runId` pattern to prevent race conditions.
- **Triggered by Logic**: Hook into the resolution of `WorkerClient.parseFile()` in `src/document/workerClient.ts` for data-driven AI tasks.
