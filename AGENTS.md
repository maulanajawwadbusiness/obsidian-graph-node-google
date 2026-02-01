# AGENTS.md: Developer Doctrine

## 1. The Doctrine

### A. 60fps Is Sacred (No Syrup)
Jitter, layout thrashing, and frame drops are critical bugs.
*   **0-Slush Scheduler**: Time must remain 1:1 with reality. If the renderer falls behind, **Drop Debt** (Stutter).
*   **Zero Thrash**: Input handlers must never touch the DOM (Caching).
*   **Decouple**: Input sampled asynchronously; Ticked synchronously in `rAF` (Fix 34).
*   **Throttle**: All scroll/resize handlers (~50ms).
*   **Bounds**: Work per frame must be bounded.

### B. Panels = Input Black Holes
The Canvas (Graph) is the substrate. Panels (Chat, Docs) and the Analysis Overlay float above it.
*   **Rule**: When a panel is active, it must own 100% of the input events.
*   **Shielding**: The `AnalysisOverlay` must block pointer + wheel events completely.
*   **Drag Authority**: When dragging a dot, it must follow the cursor 1:1. Physics forces are ignored for the dragged node.

### C. Minimal Diffs & Side Reports
*   **Touch only what is necessary**. Prefer modular hooks over monolithic components.
*   **Mission Protocol**: Every major work block (e.g., performance fixes, refactors) MUST be accompanied by a side report in `docs/` and a corresponding git commit.

## 2. Project Map

| Domain | Path | Description |
| :--- | :--- | :--- |
| **Physics/Graph** | `src/physics/` | Hybrid solver (forces + PBD + diffusion) and WebGL renderer. |
| **Paper Analyzer** | `src/ai/paperAnalyzer.ts` | The "Essence" distiller (Main Topic + 4 Points). |
| **Full Chat** | `src/fullchat/` | Right panel. `FullChatStore` + `fullChatAi` module. |
| **Mini Chat** | `src/popup/` | Node popover chat logic (`PopupStore.tsx`). |
| **Document Pipe** | `src/store/documentStore.tsx` | Worker-based parsing (PDF/TXT/MD). |
| **UI Markers** | `src/playground/components/` | `BrandLabel` (Top-Left) and `MapTitleBlock` (Title). |

## 3. Safe Workflow

1.  **Scan**: Read `docs/repo_xray.md`.
    *   **Physics Work**: **STOP.** Read `docs/PHYSICS_ATLAS.md` first. The Acceptance Tests (T1–T7) are your Truth Harness.
    *   **Render/DPR Work**: Read `docs/onboarding_dpr_rendering.md`. **Mandatory for avoiding visual regressions.**
    *   Do not guess.
2.  **Dissect**: Identify load-bearing logic (runIds, refs, context priorities).
3.  **Instrument**: Add minimal metrics/logs before changing behavior.
4.  **Implement**: Make small, verifiable changes. Use `console.log` tags like `[PhysicsPerf]`.
5.  **Verify**: Manual verification is required.
6.  **Docs**: Update `docs/*.md` to reflect new truth.
7.  **Commit**: Use compact, descriptive messages (`feat(chat): ...`).

## 4. CRITICAL WARNINGS

### Use `task_boundary` Sparingly (3+2 Rule)
Only use `task_boundary` for distinct, complex sub-tasks (~1 per 5 steps).
**NEVER use Browser Testing Tools.**

### POWERSHELL CAUTION
Do NOT use `&&` in the terminal. It breaks the parser. Use separate commands or use `;` correctly.

### DO NOT Break The "Dot"
Terminology matters. In the graph, we render "Dots", not "Nodes" (though the data structure is a node). Keep performance-first language.

### 0-Dependency Philosophy
*   **Default Stance**: Prioritize standard Web APIs over third-party libraries.
*   **Heuristic**: "Can this be written robustly in <100 lines?" If yes, own the code.

### POINTER CAPTURE BUBBLING (Visual UI)
*   **Problem**: In `GraphPhysicsPlayground`, the parent container captures the pointer on `pointerdown` for drag handling.
*   **Risk**: Any UI button (Overlay, Toggle) that sits on top MUST stop propagation of `onPointerDown`.
*   **Symptom**: If you skip this, the button will "click" visually (hover works) but the parent will steal the logic click.
*   **Rule**: Always add `onPointerDown={(e) => e.stopPropagation()}` to **ALL** interactive overlay elements. DO NOT FORGET IT.

## 5. Perf Doctrine (Physics)

### A. The Scheduler
*   **Invariant**: `accumulatorMs` never exceeds `maxStepsPerFrame * fixedStepMs`.
*   **Failure Mode**: If we fall behind, we hard-reset (`droppedMs`). We prefer visual stutter (teleport) over temporal lag (syrup).

### B. Adaptive Gating
*   **Energy Gate**: Expensive passes (Spacing) run only when energy allows.
*   **Phase Staggering**: Split heavy O(N) or O(N²) work across multiple frames (prime modulo staggering).
*   **Safety Limits**: If N/E exceed the safe envelope, degradations trigger automatically (Stressed -> Fatal).

## 6. AI Doctrine

### A. Current Rules
*   **Responses API**: The OpenAI path MUST use the `v1/responses` endpoint.
*   **Strict Param Hygiene**: `maxCompletionTokens` (YES), `response_format` (YES).
*   **Context**: Intelligence is relative. Always prefer `pendingContext` (Content Title/Summary) over generic document text.

### B. Streaming
*   **SDK-Defined Boundaries**: The Provider/SDK defines logic chunks. Do not reshape in transport.
*   **No Smoothing**: Do not "smooth" text stream in the client. Visual smoothing is a UI concern (CSS).
*   **Structure**: JSON outputs should be buffered and parsed, not streamed partially.

## 7. Interaction Doctrine
*   **Wake-on-Drag**: Interaction wakes the local cluster to allow settling.
*   **Sleep**: Nodes settle to `isSleeping=true` to save CPU. They wake only on interaction or high energy.
*   **Hand Authority**: User input overrides all physics constraints.
