# AGENTS.md: Developer Doctrine

**Welcome, Agent.**
This file outlines the sacred laws of the Arnvoid project. Read it before touching code.

## 1. The Doctrine

### A. 60fps Is Sacred
Jitter, layout thrashing, and frame drops are critical bugs.
*   **Never** block the main thread.
*   **Never** put expensive logic in a render loop.
*   **Throttle** all scroll/resize handlers (Streaming text autosize should be ~50ms).

### B. Panels Own Integration
The Canvas (Graph) is the substrate. Panels (Chat, Docs) and the Analysis Overlay float above it.
*   **Rule**: When a panel/overlay is active, it must own 100% of the input events within its rect (or the full viewport for overlays).
*   **Shielding**: The `AnalysisOverlay` must block pointer + wheel events completely to prevent graph disturbance during AI analysis.

### C. Minimal Diffs & Side Reports
*   Touch only what is necessary. Prefer modular hooks over monolithic components.
*   **Mission Protocol**: Every major work block MUST be accompanied by a side report in `docs/` and a corresponding git commit.

## 2. Project Map

| Domain | Path | Description |
| :--- | :--- | :--- |
| **Physics/Graph** | `src/physics/` | ForceAtlas2 engine and WebGL renderer. |
| **Paper Analyzer** | `src/ai/paperAnalyzer.ts` | The "Essence" distiller (Main Topic + 4 Points). |
| **Full Chat** | `src/fullchat/` | Right panel. `FullChatStore` + `fullChatAi` module. |
| **Mini Chat** | `src/popup/` | Node popover chat logic (`PopupStore.tsx`). |
| **Document Pipe** | `src/store/documentStore.tsx` | Worker-based parsing (PDF/TXT/MD). |
| **UI Markers** | `src/playground/components/` | `BrandLabel` (Top-Left) and `MapTitleBlock` (Title). |

## 3. Safe Workflow

1.  **Scan**: Read `docs/system.md` and related code first. Do not guess.
2.  **Dissect**: Identify the "load-bearing" logic (runIds, refs, context priorities).
3.  **Implement**: Make small, verifiable changes. Use `console.log` tags like `[MiniChatAI]` or `[Prefill]`.
4.  **Verify**: Manual verification is required.
5.  **Docs**: Update `docs/*.md` to reflect new truth.
6.  **Commit**: Use compact, descriptive messages (`feat(chat): ...`).

## 4. CRITICAL WARNINGS

### ⛔ NEVER Use `task_boundary` or Browser Testing Tools
These tools are currently broken or unreliable in this environment. Manage your own context through code analysis and manual reporting.

### ⛔ POWERSHELL CAUTION
Do NOT use `&&` in the terminal. It breaks the parser. Use separate commands or use `;` correctly.

### ⛔ DO NOT Break The "Dot"
Terminology matters. In the graph, we render "Dots", not "Nodes" (though the data structure is a node). Keep performance-first language.

### ⛔ UI CONFIG KNOBS
UI markers (Brand/Title) are controlled via `src/playground/graphPlaygroundStyles.ts`. Check `SHOW_MAP_TITLE` and `SHOW_BRAND_LABEL` before assuming they deleted.

## 5. AI Doctrine (The Brain)

### A. Current Rules
*   **Responses API**: The OpenAI path MUST use the `v1/responses` endpoint.
*   **Strict Param Hygiene**:
    *   `maxCompletionTokens` (YES) vs `maxTokens` (NO).
    *   `response_format` (YES) vs legacy JSON modes.
    *   **Reasoning Models**: Do NOT send `temperature` or low `maxCompletionTokens` caps to `gpt-5` series models.

### B. The "Single SDK" Refactor (Future)
We are moving to a unified architecture where `LLMClient` wraps a single OpenAI SDK instance.
*   **Routing**: Switch providers via `baseURL` (`https://openrouter.ai/api/v1`) and `apiKey`.
*   **Goal**: Zero divergence in parsing or streaming logic.
## 6. Arnvoid Streaming Doctrine (Responses API)

### A. Principles
*   **SDK-Defined Boundaries**: The Provider/SDK defines what a "chunk" is. Do not reshape, combine, or split chunks in the transport layer.
*   **Events over Typing**: Consume streaming as a sequence of data events, not a "typing simulation".
*   **Source vs Pump**:
    *   **Source** (`LLMClient`): Async generator that yields text deltas. Pure data.
    *   **Pump** (Store/UI): Consumes the generator, appends to state, and handles rendering hygiene (e.g. throttling to 30fps).
    *   *Never* put render logic in the Source.
*   **No Semantic Smoothing**: Do not "smooth" the text stream for aesthetics in the API client. Visual smoothing is a UI concern.

### B. Invariants
*   **Abort Correctness**: New `runId` MUST cancel the old stream immediately.
*   **Stable Fallbacks**:
    *   Mock mode must always work.
    *   Non-streaming network error -> Fallback to Mock (Graceful degradation).
*   **Structured Outputs**:
    *   **Chat**: Stream text deltas.
    *   **JSON/Analysis**: Buffer the full output, then parse. Do not attempt to stream partial JSON unless using a specialized parser.

### C. Implementation Reference (The "Pump")
*   Source: `src/ai/openaiClient.ts` (`generateTextStream`)
*   Middleman: `src/fullchat/fullChatAi.ts` (`realResponseGenerator`)
*   Pump: `src/fullchat/FullChatStore.tsx` (consumes generator, updates `streamingText`)

## 7. The Zero-Dependency Strategy
**Philosophy**: Minimal Surface Area. Maximum Control.
*   **Default Stance**: Prioritize standard Web APIs over third-party libraries.
*   **Evaluation**: Justify every dependency against three risks: Maintenance Churn, Bundle Bloat, and Loss of Control.
*   **Heuristic**: "Can this be written robustly in <100 lines?" If yes, own the code.
*   **Refactor Warning**: SDK migrations are architectural decisions, not just "cleanups". Only propose them if the manual maintenance burden outweighs the benefits of ownership.
